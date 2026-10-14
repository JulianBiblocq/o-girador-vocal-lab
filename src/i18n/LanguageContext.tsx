/**
 * LanguageContext.tsx
 * Contexte React i18n pour O Girador • Vocal Lab avec fallback sécurisé HMR.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translationsFr, type TranslationKey } from './translationsFr';
import { translationsPt } from './translationsPt';

export type Locale = 'fr' | 'pt';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const STORAGE_KEY = 'ogirador_vocal_lab_locale';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'pt') return saved;
      return 'fr';
    } catch {
      return 'fr';
    }
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      if (locale === 'pt') {
        return translationsPt[key] ?? translationsFr[key] ?? key;
      }
      return translationsFr[key] ?? key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: 'fr',
      setLocale: () => {},
      t: (key: TranslationKey) => translationsFr[key] ?? key,
    };
  }
  return context;
}
