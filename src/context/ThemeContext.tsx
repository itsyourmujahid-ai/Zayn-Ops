import React, { createContext, useContext, useState, useEffect } from 'react';

export type ZaynOsThemeId = 'obsidian-gold' | 'midnight-navy' | 'emerald-noir';

export interface ZaynOsThemeConfig {
  id: ZaynOsThemeId;
  name: string;
  style: string;
  tagline: string;
  bgBase: string;
  bgCard: string;
  colorPrimary: string;
  textMain: string;
  textMuted: string;
  borderColor: string;
}

export const ZAYNOS_THEMES: Record<ZaynOsThemeId, ZaynOsThemeConfig> = {
  'obsidian-gold': {
    id: 'obsidian-gold',
    name: 'Obsidian & Champagne Gold',
    style: 'Luxury Elite',
    tagline: 'High-contrast obsidian black paired with champagne gold accents for an executive, prestigious aesthetic.',
    bgBase: '#121212',
    bgCard: '#2C2C2C',
    colorPrimary: '#D4AF37',
    textMain: '#FAFAFA',
    textMuted: '#A1A1AA',
    borderColor: '#27272a',
  },
  'midnight-navy': {
    id: 'midnight-navy',
    name: 'Midnight Navy & Electric Cyan',
    style: 'Modern SaaS',
    tagline: 'Deep cosmic slate navy with electric cyan highlights, calibrated for modern enterprise technology teams.',
    bgBase: '#0F172A',
    bgCard: '#1E293B',
    colorPrimary: '#0EA5E9',
    textMain: '#F8FAFC',
    textMuted: '#64748B',
    borderColor: '#334155',
  },
  'emerald-noir': {
    id: 'emerald-noir',
    name: 'Emerald Noir',
    style: 'Growth & Fintech',
    tagline: 'Deep carbon noir canvas accented with vibrant emerald green, inspiring financial velocity and pipeline growth.',
    bgBase: '#09090B',
    bgCard: '#18181B',
    colorPrimary: '#10B981',
    textMain: '#E4E4E7',
    textMuted: '#71717A',
    borderColor: '#27272a',
  },
};

const STORAGE_KEY = 'zaynos_theme';

interface ThemeContextValue {
  theme: ZaynOsThemeId;
  themeConfig: ZaynOsThemeConfig;
  setTheme: (theme: ZaynOsThemeId) => void;
  availableThemes: ZaynOsThemeConfig[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ZaynOsThemeId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as ZaynOsThemeId;
      if (stored && ZAYNOS_THEMES[stored]) {
        return stored;
      }
    }
    return 'obsidian-gold';
  });

  const setTheme = (newTheme: ZaynOsThemeId) => {
    if (ZAYNOS_THEMES[newTheme]) {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch (e) {
        console.warn('Unable to store theme preference in localStorage:', e);
      }
    }
  };

  useEffect(() => {
    // Apply data-theme attribute directly to document element and body
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    // Also update meta theme-color for mobile browser address bars
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', ZAYNOS_THEMES[theme].bgBase);
  }, [theme]);

  const themeConfig = ZAYNOS_THEMES[theme];
  const availableThemes = Object.values(ZAYNOS_THEMES);

  return (
    <ThemeContext.Provider value={{ theme, themeConfig, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
