import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { themes, type ThemeName } from './tokens/semantic';
import { ThemeContext } from './useTheme';

const STORAGE_KEY = 'rv-theme';

function readStored(): ThemeName {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ThemeName;
}) {
  const [name, setName] = useState<ThemeName>(() => initial ?? readStored());

  useEffect(() => {
    document.documentElement.dataset.theme = name;
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, [name]);

  // Keep in sync when a parent (e.g. Storybook) controls the theme.
  useEffect(() => {
    if (initial) setName(initial);
  }, [initial]);

  const toggle = useCallback(() => setName((n) => (n === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(
    () => ({ name, tokens: themes[name], setTheme: setName, toggle }),
    [name, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
