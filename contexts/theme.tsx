import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Scheme = 'light' | 'dark';

const ThemeContext = createContext<{ scheme: Scheme; toggle: () => void }>({
  scheme: 'light',
  toggle: () => {},
});

export function ThemeSchemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() ?? 'light';
  const [scheme, setScheme] = useState<Scheme>(system);

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setScheme(saved);
    });
  }, []);

  const toggle = async () => {
    const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
    setScheme(next);
    await AsyncStorage.setItem('theme', next);
  };

  return (
    <ThemeContext.Provider value={{ scheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppScheme() {
  return useContext(ThemeContext);
}
