import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, userApi, setToken, removeToken, getToken, BASE_URL } from '@/services/api';
import { supabase } from '@/utils/supabase';
import { clearSupabaseSessionCache } from '@/utils/supabaseSession';

const AuthContext = createContext(null);

function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function hasSupabaseSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearSupabaseSessionCache();
        }
        return false;
      }
      return Boolean(data?.session?.access_token);
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearSupabaseSessionCache();
      }
      return false;
    }
  }

  async function restoreSession() {
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const data = await authApi.verify();
      setUser(data.user);
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));

      const supabaseSessionReady = await hasSupabaseSession();
      if (!supabaseSessionReady) {
        await clearSupabaseSessionCache();
      }
    } catch {
      await removeToken();
      await AsyncStorage.removeItem('lawyerup_user');
      await clearSupabaseSessionCache();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function syncSupabaseSessionFromPayload(sessionPayload, { required = false } = {}) {
    const accessToken = sessionPayload?.access_token;
    const refreshToken = sessionPayload?.refresh_token;
    if (!accessToken || !refreshToken) {
      if (required) {
        throw new Error('No Supabase session found. Please sign in again.');
      }
      return;
    }

    const applySession = () =>
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

    let { error } = await applySession();
    if (error && isInvalidRefreshTokenError(error)) {
      // Recover from stale or corrupted persisted auth state, then retry once.
      await clearSupabaseSessionCache();
      const retryResult = await applySession();
      error = retryResult.error;
    }

    if (error && required) {
      await clearSupabaseSessionCache();
      throw new Error(error.message || 'Failed to initialize Supabase session. Please sign in again.');
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    try {
      await setToken(data.token);
      await syncSupabaseSessionFromPayload(data.supabaseSession, { required: true });
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      await removeToken();
      await AsyncStorage.removeItem('lawyerup_user');
      await clearSupabaseSessionCache();
      setUser(null);
      throw error;
    }
  }

  async function parseResponse(res) {
    const raw = await res.text();
    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch {
      return { message: raw };
    }
  }

  async function register(name, email, password, role, phoneNumber, diplomaAsset, specialization, bio, experienceYears) {
    if (role === 'lawyer') {
      if (!diplomaAsset) {
        throw new Error('Please upload your diploma to register as a lawyer');
      }

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
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');

      // Lawyer accounts are pending verification; do not sign in automatically.
      await clearSupabaseSessionCache();
      await removeToken();
      await AsyncStorage.removeItem('lawyerup_user');
      setUser(null);
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
    try {
      await setToken(data.token);
      await syncSupabaseSessionFromPayload(data.supabaseSession, { required: true });
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      await removeToken();
      await AsyncStorage.removeItem('lawyerup_user');
      await clearSupabaseSessionCache();
      setUser(null);
      throw error;
    }
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
    await clearSupabaseSessionCache();
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
