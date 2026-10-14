/**
 * App.tsx
 * Point d'entrée de O Girador • Vocal Lab avec i18n bilingue (FR/PT),
 * mode plein écran Desktop responsive et gestion du thème.
 */
import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LivretPrise } from './components/livret-prise/LivretPrise';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mic, Sun, Moon, Radio, Maximize2, Minimize2 } from 'lucide-react';

const STORAGE_FULLWIDTH_KEY = 'ogirador_vocal_lab_fullwidth';

const AppContent: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FULLWIDTH_KEY);
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth >= 1024;
    } catch {
      return true;
    }
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggleFullWidth = () => {
    setIsFullWidth((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_FULLWIDTH_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-ink flex flex-col p-2.5 sm:p-4 md:p-6 transition-colors duration-200">
      <header className={`w-full mb-4 cordel-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 ${isFullWidth ? 'max-w-none' : 'max-w-3xl mx-auto'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 cordel-card-sm bg-theme-wood text-theme-ink shrink-0">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-theme-accent" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-black tracking-widest uppercase m-0 leading-tight">
              {t('appTitle')}
            </h1>
            <p className="text-[11px] sm:text-xs font-mono opacity-70 m-0 hidden xs:block">
              {t('appSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur FR / PT */}
          <div className="flex items-center cordel-card-sm p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setLocale('fr')}
              className={`px-2 py-1 rounded transition-colors ${locale === 'fr' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'opacity-60 hover:opacity-100'}`}
              title="Français"
            >
              🇫🇷 FR
            </button>
            <span className="opacity-30">|</span>
            <button
              type="button"
              onClick={() => setLocale('pt')}
              className={`px-2 py-1 rounded transition-colors ${locale === 'pt' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'opacity-60 hover:opacity-100'}`}
              title="Português do Brasil"
            >
              🇧🇷 PT
            </button>
          </div>

          {/* Commutateur Plein écran / Compact */}
          <button
            type="button"
            onClick={toggleFullWidth}
            className="cordel-btn p-2 text-xs flex items-center gap-1.5 cursor-pointer"
            title={isFullWidth ? t('viewCompact') : t('viewFullWidth')}
          >
            {isFullWidth ? <Minimize2 className="w-4 h-4 text-theme-accent" /> : <Maximize2 className="w-4 h-4 text-theme-accent" />}
            <span className="hidden md:inline font-mono text-[11px]">{isFullWidth ? t('viewCompact') : t('viewFullWidth')}</span>
          </button>

          {/* Badge Port */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 cordel-card-sm text-[11px] font-mono">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>{t('port')}</span>
          </div>

          {/* Bouton Thème */}
          <button type="button" onClick={toggleTheme} className="cordel-btn p-2 text-xs flex items-center justify-center cursor-pointer" title={t('themeToggle')}>
            {theme === 'dark' ? <Sun className="w-4 h-4 text-theme-accent" /> : <Moon className="w-4 h-4 text-theme-wood" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start w-full">
        <LivretPrise isFullWidth={isFullWidth} />
      </main>

      <footer className={`w-full mt-6 text-center text-xs font-mono opacity-60 flex flex-col gap-1 ${isFullWidth ? 'max-w-none' : 'max-w-3xl mx-auto'}`}>
        <div>{t('footerSandbox')}</div>
        <div>{t('footerPack')}</div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
