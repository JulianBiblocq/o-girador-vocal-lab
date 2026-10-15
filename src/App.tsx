/**
 * App.tsx
 * Point d'entrée de O Girador - Atelier Vocal (Oficina Vocal) avec i18n bilingue [ FR | BR ],
 * Bibliothèque de Patterns nommables (Puxador/Coro) et Frise Conducteur sur 1 seule ligne Desktop.
 */
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ToadaProjectProvider } from './context/ToadaProjectContext';
import { PatternLibraryBar } from './components/conductor/PatternLibraryBar';
import { ToadaConductorStrip } from './components/conductor/ToadaConductorStrip';
import { LivretPrise } from './components/livret-prise/LivretPrise';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mic, Sun, Moon } from 'lucide-react';

const AppContent: React.FC = () => {
  const { locale, setLocale, t } = useLanguage();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('ogirador_vocal_lab_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ogirador_vocal_lab_theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-ink flex flex-col p-2.5 sm:p-4 md:p-6 transition-colors duration-200">
      <header className="w-full max-w-none mb-3 cordel-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 cordel-card-sm bg-theme-wood text-white shrink-0">
            <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
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

        {/* Controles a droite : Binome [ FR | BR ] & Theme */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 cordel-card-sm inline-flex items-center p-0.5 text-xs font-mono select-none">
            <button
              type="button" onClick={() => setLocale('fr')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer ${
                locale === 'fr' ? 'bg-theme-wood text-white font-black shadow-sm' : 'opacity-60 hover:opacity-100 text-theme-ink'
              }`}
              title="Francais"
            >
              FR
            </button>
            <button
              type="button" onClick={() => setLocale('br')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer ${
                locale === 'br' ? 'bg-theme-wood text-white font-black shadow-sm' : 'opacity-60 hover:opacity-100 text-theme-ink'
              }`}
              title="Portugues Brasileiro"
            >
              BR
            </button>
          </div>

          <button
            type="button" onClick={toggleTheme}
            className="h-9 w-9 p-0 cordel-card-sm inline-flex items-center justify-center cursor-pointer transition-colors"
            title={t('themeToggle')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-theme-accent" /> : <Moon className="w-4 h-4 text-theme-accent" />}
          </button>
        </div>
      </header>

      {/* Grille sur 1 ligne sur Desktop : Bibliotheque & Frise Conducteur cote a cote */}
      <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch mb-3.5">
        <div className="xl:col-span-5 h-full">
          <PatternLibraryBar />
        </div>
        <div className="xl:col-span-7 h-full">
          <ToadaConductorStrip />
        </div>
      </div>

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
      <ToadaProjectProvider>
        <AppContent />
      </ToadaProjectProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
