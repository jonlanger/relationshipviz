import { createContext, useContext } from 'react';
import type { ThemeName, ThemeTokens } from './tokens/semantic';

export interface ThemeContextValue {
  name: ThemeName;
  /** Resolved token values — for canvas/WebGL/SVG consumers that can't read CSS vars. */
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
