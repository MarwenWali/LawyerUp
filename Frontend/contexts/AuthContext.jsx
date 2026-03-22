import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, userApi, setToken, removeToken, getToken, BASE_URL } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const token = await getToken();
      if (token) {
        const data = await authApi.verify();
        setUser(data.user);
        await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      }
    } catch {
      await removeToken();
      await AsyncStorage.removeItem('lawyerup_user');
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    await setToken(data.token);
    await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password, role, phoneNumber, diplomaAsset, specialization, bio, experienceYears) {
    if (role === 'lawyer' && diplomaAsset) {
      const formData = new FormData();
      formData.append('fullName', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('role', role);
      if (phoneNumber) formData.append('phoneNumber', phoneNumber);
      if (specialization) formData.append('specialization', specialization);
      if (bio) formData.append('bio', bio);
      if (experienceYears) formData.append('experienceYears', String(experienceYears));
      formData.append('diploma', {
        uri: diplomaAsset.uri,
        name: diplomaAsset.fileName || 'diploma.jpg',
        type: diplomaAsset.mimeType || 'image/jpeg',
      });
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      await setToken(data.token);
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    }

    const data = await authApi.register({
      fullName: name,
      email,
      password,
      role,
      phoneNumber: phoneNumber || undefined,
      specialization: specialization || undefined,
      bio: bio || undefined,
      experienceYears: experienceYears || undefined,
    });
    await setToken(data.token);
    await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function updateUser(data) {
    const result = await userApi.updateMe(data);
    const updated = { ...user, ...result.user };
    setUser(updated);
    await AsyncStorage.setItem('lawyerup_user', JSON.stringify(updated));
    return updated;
  }

  async function uploadPhoto(asset) {
    const formData = new FormData();
    formData.append('photo', {
      uri: asset.uri,
      name: asset.fileName || 'photo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
    const result = await userApi.uploadPhoto(formData);
    const updated = { ...user, profile_photo_url: result.profile_photo_url };
    setUser(updated);
    await AsyncStorage.setItem('lawyerup_user', JSON.stringify(updated));
    return updated;
  }

  async function logout() {
    setUser(null);
    await removeToken();
    await AsyncStorage.removeItem('lawyerup_user');
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    updateUser,
    uploadPhoto,
    logout,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
