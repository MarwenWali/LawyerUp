import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('light'); // 'light' or 'dark'

  useEffect(() => {
    loadTheme();
  }, []);

  async function loadTheme() {
    try {
      const stored = await AsyncStorage.getItem('lawyerup_theme');
      if (stored && (stored === 'light' || stored === 'dark')) {
        setThemeMode(stored);
      }
    } catch (e) {
      console.error('Failed to load theme', e);
    }
  }

  async function toggleTheme(mode) {
    setThemeMode(mode);
    await AsyncStorage.setItem('lawyerup_theme', mode);
  }

  const currentTheme = useMemo(() => {
    return themeMode === 'dark' ? Colors.dark : Colors.light;
  }, [themeMode]);

  const value = useMemo(() => ({
    theme: currentTheme,
    themeMode,
    isDark: themeMode === 'dark',
    toggleTheme,
  }), [currentTheme, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
  return ctx;
}
