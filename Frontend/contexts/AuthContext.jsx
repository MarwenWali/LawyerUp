import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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

  // FIX 1: Start as true so the loading screen shows immediately on launch
  // instead of briefly flashing the landing page before restoreSession runs.
  const [isLoading, setIsLoading] = useState(true);

  // FIX 3: Prevent the Supabase auth listener from clearing the session
  // while restoreSession is still in progress (race condition guard).
  const isRestoringSession = useRef(true);

  async function clearLocalAuthState() {
    setUser(null);
    await clearSupabaseSessionCache();
    await removeToken();
    await AsyncStorage.removeItem('lawyerup_user');
  }

  useEffect(() => {
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Supabase auth state change:', event, !!session);

      if (event === 'INITIAL_SESSION') return;

      // FIX 3: Ignore Supabase events that fire during session restore.
      // Supabase emits SIGNED_OUT on cold start before restoreSession has
      // finished writing to AsyncStorage, causing a false logout.
      if (isRestoringSession.current) return;

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        const [token, cachedUser] = await Promise.all([
          getToken(),
          AsyncStorage.getItem('lawyerup_user'),
        ]);
        const hasLocalAppSession = Boolean(token || cachedUser);
        if (!hasLocalAppSession) return;

        console.log('Clearing session due to auth state change');
        await clearLocalAuthState();
      }
    });

    return () => subscription.unsubscribe();
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
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      try {
        const supabaseSessionReady = await hasSupabaseSession();
        if (!supabaseSessionReady) {
          console.warn('Supabase session not available; continuing with JWT auth');
        }
      } catch (supabaseError) {
        console.warn('Supabase session check failed:', supabaseError.message);
      }

      // FIX 2: Race authApi.verify() against an 8-second timeout so the app
      // never gets stuck on the loading screen if the network is slow or the
      // backend is unreachable.
      const data = await Promise.race([
        authApi.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session restore timeout')), 8000)
        ),
      ]);

      setUser(data.user);
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));

      const supabaseSessionReady = await hasSupabaseSession();
      if (!supabaseSessionReady) {
        await clearSupabaseSessionCache();
      }
    } catch {
      await clearLocalAuthState();
    } finally {
      // FIX 3: Mark restore as done before releasing the loading state so the
      // auth listener doesn't fire a false SIGNED_OUT between these two lines.
      isRestoringSession.current = false;
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
      await clearSupabaseSessionCache();
      return;
    }

    await clearSupabaseSessionCache();

    const applySession = () =>
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

    let { error } = await applySession();
    if (error && isInvalidRefreshTokenError(error)) {
      await clearSupabaseSessionCache();
      const retryResult = await applySession();
      error = retryResult.error;
    }

    if (error && required) {
      await clearSupabaseSessionCache();
      throw new Error(error.message || 'Failed to initialize Supabase session. Please sign in again.');
    }

    if (error) {
      console.warn('Supabase session sync warning:', error.message || error);
      await clearSupabaseSessionCache();
    }
  }

  async function login(email, password, role) {
    const data = await authApi.login(email, password, role);
    try {
      await setToken(data.token);
      // Attempt to sync Supabase session, but don't require it for authentication
      try {
        await syncSupabaseSessionFromPayload(data.supabaseSession, { required: false });
      } catch (supabaseError) {
        console.warn('Supabase session sync warning:', supabaseError.message);
        // Continue login even if Supabase sync fails - JWT authentication is still valid
      }
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      await clearLocalAuthState();
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

      await clearLocalAuthState();
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
      // Attempt to sync Supabase session, but don't require it for authentication
      try {
        await syncSupabaseSessionFromPayload(data.supabaseSession, { required: false });
      } catch (supabaseError) {
        console.warn('Supabase session sync warning during registration:', supabaseError.message);
        // Continue registration even if Supabase sync fails - JWT authentication is still valid
      }
      await AsyncStorage.setItem('lawyerup_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      await clearLocalAuthState();
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
    await clearLocalAuthState();
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
