/**
 * KaryaDEX — Theme Context & Hook
 * 
 * Provides theme-aware colors throughout the app.
 * Supports system theme detection + manual override.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { light, dark, type ColorScheme } from './theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ColorScheme;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setMode] = useState<ThemeMode>('dark');

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? dark : light;

  const toggle = useCallback(() => {
    setMode((prev) => {
      if (prev === 'system') return isDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [isDark]);

  const value = useMemo(
    () => ({ colors, isDark, mode, setMode, toggle }),
    [colors, isDark, mode, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback to dark theme if no provider
    return {
      colors: dark,
      isDark: true,
      mode: 'dark',
      setMode: () => {},
      toggle: () => {},
    };
  }
  return context;
}

export { ThemeContext };

/**
 * DarkThemeScope — Forces the dark obsidian atmosphere for subtree components
 * (such as the Onboarding flow) regardless of the system OS color scheme.
 */
export function DarkThemeScope({ children }: { children: React.ReactNode }) {
  const darkValue = useMemo<ThemeContextValue>(
    () => ({
      colors: dark,
      isDark: true,
      mode: 'dark',
      setMode: () => {},
      toggle: () => {},
    }),
    []
  );

  return (
    <ThemeContext.Provider value={darkValue}>
      {children}
    </ThemeContext.Provider>
  );
}
