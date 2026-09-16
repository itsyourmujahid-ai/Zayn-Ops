import React, { createContext, useContext, useState, useEffect } from 'react';

export type ZaynOpsThemeId = 'zaynops-light' | 'zaynops-slate' | 'zaynops-dark';
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
  'zaynops-light': {
    id: 'zaynops-light',
    name: 'ZaynOps Pure Light',
    style: 'Minimal Executive',
    tagline: 'Light-first, high-precision interface with generous negative space and signature emerald accents.',
    bgBase: '#F8FAFC',
    bgCard: '#FFFFFF',
    colorPrimary: '#0CB675',
    textMain: '#0F172A',
    textMuted: '#64748B',
    borderColor: '#E2E8F0',
  },
  'zaynops-slate': {
    id: 'zaynops-slate',
    name: 'ZaynOps Slate Light',
    style: 'Quiet Contrast',
    tagline: 'Soft off-white canvas with restrained slate tones for long commercial sessions.',
    bgBase: '#F1F5F9',
    bgCard: '#FFFFFF',
    colorPrimary: '#059669',
    textMain: '#0F172A',
    textMuted: '#475569',
    borderColor: '#E2E8F0',
  },
  'zaynops-dark': {
    id: 'zaynops-dark',
    name: 'ZaynOps Obsidian Dark',
    style: 'Executive Night',
    tagline: 'Refined deep obsidian canvas with crisp typography and subtle emerald luminescence.',
    bgBase: '#090D16',
    bgCard: '#111827',
    colorPrimary: '#10B981',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8',
    borderColor: '#1F2937',
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
      const stored = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as string;
      if (stored && (stored in ZAYNOPS_THEMES)) {
        return stored as ZaynOpsThemeId;
      }
      // Migrate old dark defaults to the requested Light-First system
      return 'zaynops-light';
    }
    return 'zaynops-light';
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
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

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
