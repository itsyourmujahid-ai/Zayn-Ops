import React, { createContext, useContext, useState, useEffect } from 'react';

export type ZaynOpsThemeId = 'obsidian-gold' | 'midnight-navy' | 'emerald-noir';
export type ZaynOsThemeId = ZaynOpsThemeId;

export interface ZaynOpsThemeConfig {
  id: ZaynOpsThemeId;
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
export type ZaynOsThemeConfig = ZaynOpsThemeConfig;

export const ZAYNOPS_THEMES: Record<ZaynOpsThemeId, ZaynOpsThemeConfig> = {
  'obsidian-gold': {
    id: 'obsidian-gold',
    name: 'Obsidian & Champagne Gold',
    style: 'Luxury Elite',
    tagline: 'High-contrast obsidian black paired with champagne gold accents for an executive, prestigious aesthetic.',
    bgBase: '#121212',
    bgCard: '#1E1E1E',
    colorPrimary: '#D4AF37',
    textMain: '#FAFAFA',
    textMuted: '#A1A1AA',
    borderColor: '#2E2E32',
  },
  'midnight-navy': {
    id: 'midnight-navy',
    name: 'Midnight Navy & Electric Cyan',
    style: 'Modern SaaS',
    tagline: 'Deep cosmic slate navy with electric cyan highlights, calibrated for modern enterprise technology teams.',
    bgBase: '#0B1120',
    bgCard: '#131D31',
    colorPrimary: '#0EA5E9',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    borderColor: '#243044',
  },
  'emerald-noir': {
    id: 'emerald-noir',
    name: 'Emerald Noir',
    style: 'Growth & Fintech',
    tagline: 'Deep carbon noir canvas accented with vibrant emerald green, inspiring financial velocity and pipeline growth.',
    bgBase: '#09090B',
    bgCard: '#141416',
    colorPrimary: '#10B981',
    textMain: '#F4F4F5',
    textMuted: '#A1A1AA',
    borderColor: '#242428',
  },
};
export const ZAYNOS_THEMES = ZAYNOPS_THEMES;

const STORAGE_KEY = 'zaynops_theme';
const LEGACY_STORAGE_KEY = 'zaynos_theme';

interface ThemeContextValue {
  theme: ZaynOpsThemeId;
  themeConfig: ZaynOpsThemeConfig;
  setTheme: (theme: ZaynOpsThemeId) => void;
  availableThemes: ZaynOpsThemeConfig[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ZaynOpsThemeId>(() => {
    if (typeof window !== 'undefined') {
      const stored = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as ZaynOpsThemeId;
      if (stored && ZAYNOPS_THEMES[stored]) {
        return stored;
      }
    }
    return 'obsidian-gold';
  });

  const setTheme = (newTheme: ZaynOpsThemeId) => {
    if (ZAYNOPS_THEMES[newTheme]) {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
        localStorage.setItem(LEGACY_STORAGE_KEY, newTheme);
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
    metaThemeColor.setAttribute('content', ZAYNOPS_THEMES[theme].bgBase);
  }, [theme]);

  const themeConfig = ZAYNOPS_THEMES[theme];
  const availableThemes = Object.values(ZAYNOPS_THEMES);

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
