import { useState, useEffect, useCallback } from "react";
import { authAPI } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

const TOKEN_KEY = "lawyerup_admin_token";
const USER_KEY = "lawyerup_admin_user";

export function useAuth() {
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);

      if (data.user?.role !== "admin") {
        throw new Error("Access denied. Admin accounts only.");
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Dummy signUp — admin accounts are created via seeding/CLI, not registration
  const signUp = useCallback(async (_email: string, _password: string) => {
    throw new Error("Admin accounts cannot be self-registered. Please contact your system administrator.");
  }, []);

  return { user, loading, signIn, signUp, signOut };
}
