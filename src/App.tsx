/**
 * App.tsx
 * Point d'entrée de O Girador - Atelier Vocal (Oficina Vocal) avec i18n bilingue [ FR | BR ],
 * Bibliothèque de Patterns nommables (Puxador/Coro) et Frise Conducteur sur 1 seule ligne Desktop.
 */
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ToadaProjectProvider } from './context/ToadaProjectContext';
import { LivretPrise } from './components/livret-prise/LivretPrise';
import { BrandHeaderLogo } from './components/header/BrandHeaderLogo';
import { ProjectSelectorBar } from './components/header/ProjectSelectorBar';
import { RoleModeSwitcher } from './components/header/RoleModeSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CordelDialogModal } from './components/ui/CordelDialogModal';
import { useGlobalTransportShortcuts } from './hooks/useGlobalTransportShortcuts';
import { useVocalLabMidi } from './hooks/useVocalLabMidi';
import { Sun, Moon } from 'lucide-react';

const AppContent: React.FC = () => {
  useGlobalTransportShortcuts();
  useVocalLabMidi();
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

  useEffect(() => {
    let pattern = 'damas';
    try {
      const saved = localStorage.getItem('ogirador-wallpaper');
      if (saved === 'none' || saved === 'rosace' || saved === 'damas' || saved === 'gravure') {
        pattern = saved === 'rosace' ? 'gravure' : saved;
      }
    } catch {}
    const classes = ['has-wallpaper-none', 'has-wallpaper-rosace', 'has-wallpaper-damas', 'has-wallpaper-gravure'];
    classes.forEach((c) => document.body.classList.remove(c));
    document.body.classList.add(`has-wallpaper-${pattern}`);
  }, []);

  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', blockContextMenu);
    return () => window.removeEventListener('contextmenu', blockContextMenu);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="relative min-h-screen bg-theme-bg text-theme-ink flex flex-col p-2.5 sm:p-4 md:p-6 transition-colors duration-200 overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none z-0 wallpaper-surface-bg"
        aria-hidden="true"
      />
      <header className="relative z-40 w-full max-w-none mb-3 cordel-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <BrandHeaderLogo />

        {/* Controles a droite : Barre Projet Cloud, Rôle Studio/Élève, Binome [ FR | BR ] & Theme */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <ProjectSelectorBar />
          <RoleModeSwitcher />
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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start w-full max-w-none">
        <LivretPrise />
      </main>

      <footer className="relative z-10 w-full max-w-none mt-6 text-center text-xs font-mono text-theme-ink/60 flex flex-col gap-1">
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
        <CordelDialogModal />
      </ToadaProjectProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
