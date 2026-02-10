import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('isDarkMode');
        if (saved !== null) setIsDark(JSON.parse(saved));
      } catch (e) {
        console.warn(e);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    await AsyncStorage.setItem('isDarkMode', JSON.stringify(newValue));
  };

  const theme = {
    isDark,
    colors: {
      background: isDark ? '#1a1a1a' : '#f6f7fb',
      surface: isDark ? '#2d2d2d' : '#fff',
      text: isDark ? '#fff' : '#000',
      textSecondary: isDark ? '#aaa' : '#666',
      primary: '#2b6cb0',
      accent: '#d32f2f',
      border: isDark ? '#444' : '#e6e6e6',
    },
  };

  return <ThemeContext.Provider value={{ ...theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
