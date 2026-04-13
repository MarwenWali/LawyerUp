import { useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { readAuth, writeAuth, clearAuth } from '../lib/storage.js';

const AUTH_EVENT = 'lawyerup_auth_changed';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => {
      const auth = readAuth();
      const raw = auth?.user ?? null;
      const u =
        raw && !raw.full_name && raw.name ? { ...raw, full_name: raw.name } : raw;
      setUser(u);
      setLoading(false);
    };
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    return () => window.removeEventListener(AUTH_EVENT, sync);
  }, []);

  const signIn = async (email, password) => {
    const res = await authAPI.login(email, password);
    if (!res?.token || !res?.user) throw new Error('Invalid response from server');
    if (res.user.role !== 'admin') throw new Error('Admin account required. Access denied.');
    const normalizedUser = {
      ...res.user,
      full_name: res.user.full_name ?? res.user.name,
    };
    writeAuth({
      token: res.token,
      user: normalizedUser,
      supabaseSession: res.supabaseSession || null,
    });
    setUser(normalizedUser);
    window.dispatchEvent(new Event(AUTH_EVENT));
    return normalizedUser;
  };

  const signOut = () => {
    clearAuth();
    setUser(null);
    window.dispatchEvent(new Event(AUTH_EVENT));
  };

  return { user, loading, signIn, signOut };
}
