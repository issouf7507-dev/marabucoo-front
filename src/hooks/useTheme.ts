import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

const KEY = 'marabu_theme';

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t === 'light' ? 'light' : '';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved ?? 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggle };
}
