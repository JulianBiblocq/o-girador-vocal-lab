/**
 * LanguageContext.tsx
 * Contexte React i18n pour O Girador • Vocal Lab avec interpolation dynamique de paramètres.
 * Supporte le binôme [ Langue Locale (FR) | Portugais Brésilien (BR) ].
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Locale, TranslationKey, TranslationParams, VocalLabTranslations } from './i18n.types';
import { translationsFr } from './translationsFr';
import { translationsBr } from './translationsBr';

export * from './i18n.types';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  dict: VocalLabTranslations;
}

const STORAGE_KEY = 'ogirador_vocal_lab_locale';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'br') return saved;
      if (saved === 'pt') return 'br'; // Rétrocompatibilité transparente
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

  const dict = useMemo<VocalLabTranslations>(() => {
    return locale === 'br' ? translationsBr : translationsFr;
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const template = dict[key] ?? translationsFr[key] ?? key;
      if (!params) return template;
      let res = template;
      for (const [pKey, pVal] of Object.entries(params)) {
        res = res.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }
      return res;
    },
    [dict]
  );

  const value = useMemo(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: 'fr',
      setLocale: () => {},
      dict: translationsFr,
      t: (key: TranslationKey, params?: TranslationParams) => {
        const template = translationsFr[key] ?? key;
        if (!params) return template;
        let res = template;
        for (const [pKey, pVal] of Object.entries(params)) {
          res = res.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }
        return res;
      },
    };
  }
  return context;
}
