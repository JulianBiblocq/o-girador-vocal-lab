/**
 * App.tsx
 * Point d'entrée de O Girador • Vocal Lab avec i18n bilingue (FR/PT),
 * plein écran permanent responsive et alignement géométrique Cordel.
 */
import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LivretPrise } from './components/livret-prise/LivretPrise';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mic, Sun, Moon } from 'lucide-react';

const AppContent: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-ink flex flex-col p-2.5 sm:p-4 md:p-6 transition-colors duration-200">
      <header className="w-full max-w-none mb-4 cordel-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 cordel-card-sm bg-theme-wood text-theme-ink shrink-0">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-theme-accent" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-black tracking-widest uppercase m-0 leading-tight">
              {t('appTitle')}
            </h1>
            <p className="text-[11px] sm:text-xs font-mono text-theme-ink/70 m-0 hidden xs:block">
              {t('appSubtitle')}
            </p>
          </div>
        </div>

        {/* Contrôles à droite : Langue & Thème calés sur h-9 (36px) */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 cordel-card-sm inline-flex items-center p-0.5 text-xs font-mono select-none">
            <button
              type="button"
              onClick={() => setLocale('fr')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer ${
                locale === 'fr'
                  ? 'bg-theme-wood text-theme-ink font-black shadow-sm'
                  : 'opacity-60 hover:opacity-100 text-theme-ink'
              }`}
              title="Français"
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLocale('pt')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer ${
                locale === 'pt'
                  ? 'bg-theme-wood text-theme-ink font-black shadow-sm'
                  : 'opacity-60 hover:opacity-100 text-theme-ink'
              }`}
              title="Português do Brasil"
            >
              PT
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="h-9 w-9 p-0 cordel-card-sm inline-flex items-center justify-center cursor-pointer transition-colors"
            title={t('themeToggle')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-theme-accent" /> : <Moon className="w-4 h-4 text-theme-accent" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start w-full max-w-none">
        <LivretPrise />
      </main>

      <footer className="w-full max-w-none mt-6 text-center text-xs font-mono text-theme-ink/60 flex flex-col gap-1">
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
