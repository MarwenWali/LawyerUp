import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [promptsUsed, setPromptsUsed] = useState(0);
  const [firstPromptTimestamp, setFirstPromptTimestamp] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const used = await AsyncStorage.getItem('promptsUsed');
        const ts = await AsyncStorage.getItem('firstPromptTimestamp');
        if (used) setPromptsUsed(parseInt(used, 10));
        if (ts) setFirstPromptTimestamp(Number(ts));
      } catch (e) {
        console.warn(e);
      }
    })();
  }, []);

  const incrementPrompt = async () => {
    const now = Date.now();
    if (!firstPromptTimestamp) {
      setFirstPromptTimestamp(now);
      await AsyncStorage.setItem('firstPromptTimestamp', String(now));
    }
    const next = promptsUsed + 1;
    setPromptsUsed(next);
    await AsyncStorage.setItem('promptsUsed', String(next));
    return next;
  };

  const resetPrompts = async () => {
    setPromptsUsed(0);
    setFirstPromptTimestamp(null);
    await AsyncStorage.removeItem('promptsUsed');
    await AsyncStorage.removeItem('firstPromptTimestamp');
  };

  const contextValue = {
    user,
    setUser,
    promptsUsed,
    firstPromptTimestamp,
    incrementPrompt,
    resetPrompts,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export default AppProvider;
