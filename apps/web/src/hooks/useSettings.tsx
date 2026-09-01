'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';

export interface ShopSettings {
  shop_name_en?: string;
  shop_name_ar?: string;
  shop_cr_number?: string;
  shop_vat_number?: string;
  shop_phone?: string;
  shop_email?: string;
  shop_address?: string;
  shop_logo_path?: string;
  receipt_header?: string;
  receipt_footer?: string;

  default_tax_rate_id?: string;
  tax_calculation_mode?: 'inclusive' | 'exclusive';
  tax_label?: string;

  currency_code?: string;
  currency_symbol?: string;
  currency_symbol_position?: 'before' | 'after';
  currency_decimals?: string;
  decimal_separator?: string;
  thousands_separator?: string;
  timezone?: string;
  date_format?: string;

  theme_mode_default?: 'light' | 'dark' | 'system';
  theme_accent_color?: string;
  ui_font_scale?: string;
  pos_density_mode?: 'comfortable' | 'compact';

  scale_barcode_prefix?: string;
  scale_barcode_format?: string;
  direct_escpos_print?: string;
  cash_drawer_auto_kick?: string;
  barcode_audio_beep?: string;
  allow_negative_stock?: string;
  quick_tender_presets?: string;

  [key: string]: any;
}

interface SettingsContextType {
  settings: ShopSettings;
  loading: boolean;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  fontSizeScale: string;
  setFontSizeScale: (scale: string) => void;
  formatCurrency: (amount: number | string | undefined | null) => string;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: ShopSettings = {
  shop_name_en: 'AL-NOOR SUPERMARKET & HYPERMARKET',
  shop_name_ar: 'AL-NOOR RETAIL POS',
  shop_cr_number: '1010123456',
  shop_vat_number: '300123456700003',
  shop_phone: '+966 11 456 7890',
  shop_email: 'info@alnoorshop.com',
  shop_address: 'King Fahd Road, Riyadh, Saudi Arabia',
  receipt_header: 'Welcome to Al-Noor Supermarket',
  receipt_footer: 'Thank you for shopping with us! Return within 7 days with invoice.',
  currency_code: 'SAR',
  currency_symbol: 'SAR',
  currency_symbol_position: 'after',
  currency_decimals: '2',
  decimal_separator: '.',
  thousands_separator: ',',
  timezone: 'Asia/Riyadh',
  date_format: 'YYYY-MM-DD',
  theme_mode_default: 'system',
  theme_accent_color: '#2563eb',
  ui_font_scale: '100%',
  pos_density_mode: 'comfortable',
  scale_barcode_prefix: '20,21,28,29',
  cash_drawer_auto_kick: 'true',
  barcode_audio_beep: 'true',
  allow_negative_stock: 'false',
  quick_tender_presets: '50,100,200,500',
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  accentColor: '#2563eb',
  setAccentColor: () => {},
  fontSizeScale: '100%',
  setFontSizeScale: () => {},
  formatCurrency: () => 'SAR 0.00',
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColorState] = useState<string>('#2563eb');
  const [fontSizeScale, setFontSizeScaleState] = useState<string>('100%');

  // Initialize theme, scale, and settings
  const refreshSettings = useCallback(async () => {
    try {
      // 1. Check local storage first for immediate responsive hydration
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('app_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeState(savedTheme);
          applyThemeClass(savedTheme);
        }

        const savedScale = localStorage.getItem('app_font_scale');
        if (savedScale) {
          setFontSizeScaleState(savedScale);
          applyFontScale(savedScale);
        }

        const savedAccent = localStorage.getItem('app_accent_color');
        if (savedAccent) {
          setAccentColorState(savedAccent);
          applyAccentColor(savedAccent);
        }
      }

      const res = await apiRequest('/settings');
      if (res.success && res.data) {
        setSettings((prev) => ({ ...prev, ...res.data }));

        // If not explicitly set in localStorage, use backend default
        const savedTheme = localStorage.getItem('app_theme');
        if (!savedTheme) {
          if (res.data.theme_mode_default === 'dark') {
            setThemeState('dark');
            applyThemeClass('dark');
          } else if (res.data.theme_mode_default === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const sysTheme = prefersDark ? 'dark' : 'light';
            setThemeState(sysTheme);
            applyThemeClass(sysTheme);
          }
        }

        if (res.data.theme_accent_color && !localStorage.getItem('app_accent_color')) {
          setAccentColorState(res.data.theme_accent_color);
          applyAccentColor(res.data.theme_accent_color);
        }

        if (res.data.ui_font_scale && !localStorage.getItem('app_font_scale')) {
          setFontSizeScaleState(res.data.ui_font_scale);
          applyFontScale(res.data.ui_font_scale);
        }
      }
    } catch (e) {
      console.warn('Failed to load shop settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyThemeClass = (t: 'light' | 'dark') => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
    }
  };

  const applyAccentColor = (color: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--color-primary', color);
      document.documentElement.style.setProperty('--shop-primary', color);
    }
  };

  const applyFontScale = (scale: string) => {
    if (typeof document !== 'undefined') {
      const pct = parseInt(scale.replace('%', ''), 10) || 100;
      const basePx = (16 * pct) / 100;
      document.documentElement.style.fontSize = `${basePx}px`;
      document.documentElement.style.setProperty('--app-font-scale', `${pct / 100}`);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_theme', newTheme);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    applyAccentColor(color);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_accent_color', color);
    }
  };

  const setFontSizeScale = (scale: string) => {
    setFontSizeScaleState(scale);
    applyFontScale(scale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_font_scale', scale);
    }
  };

  const formatCurrency = (amount: number | string | undefined | null): string => {
    const val = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
    const symbol = settings.currency_symbol || 'SAR';
    const position = settings.currency_symbol_position || 'after';
    const decimals = parseInt(String(settings.currency_decimals ?? 2), 10);
    const decSep = settings.decimal_separator || '.';
    const thouSep = settings.thousands_separator || ',';

    if (isNaN(val)) return position === 'before' ? `${symbol} 0.00` : `0.00 ${symbol}`;

    const parts = val.toFixed(decimals).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
    const decPart = parts.length > 1 ? `${decSep}${parts[1]}` : '';
    const formatted = `${intPart}${decPart}`;

    return position === 'before' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        theme,
        setTheme,
        toggleTheme,
        accentColor,
        setAccentColor,
        fontSizeScale,
        setFontSizeScale,
        formatCurrency,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
