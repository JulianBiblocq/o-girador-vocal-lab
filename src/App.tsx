/**
 * App.tsx
 * Point d'entrée de O Girador — Cantador avec navigation 5 livrets + ⚙️ Réglages (< 135 lignes).
 */
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ToadaProjectProvider } from './context/ToadaProjectContext';
import { AudioHardwareProvider } from './context/AudioHardwareContext';
import { BrandHeaderLogo } from './components/header/BrandHeaderLogo';
import { ProjectSelectorBar } from './components/header/ProjectSelectorBar';
import { RoleModeSwitcher } from './components/header/RoleModeSwitcher';
import { UserAvatarMenu } from './components/header/UserAvatarMenu';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CordelDialogModal } from './components/ui/CordelDialogModal';
import { AppUpdateBanner } from './components/common/AppUpdateBanner';
import { MainLivretNavbar } from './components/navigation/MainLivretNavbar';
import { LivretContentRenderer } from './components/navigation/LivretContentRenderer';
import { useGlobalTransportShortcuts } from './hooks/useGlobalTransportShortcuts';
import { useVocalLabMidi } from './hooks/useVocalLabMidi';
import { usePwaInstall } from './hooks/usePwaInstall';
import { Sun, Moon } from 'lucide-react';

const AppContent: React.FC = () => {
  useGlobalTransportShortcuts();
  useVocalLabMidi();
  const { locale, setLocale, t } = useLanguage();
  const { isInstalled, triggerInstall } = usePwaInstall(locale);
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
    let pattern = 'gravure';
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

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div className="relative min-h-screen bg-theme-bg text-theme-ink flex flex-col p-2.5 sm:p-4 md:p-6 transition-colors duration-200 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 wallpaper-surface-bg" aria-hidden="true" />
      <header className="relative z-40 w-full max-w-none mb-3 cordel-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <BrandHeaderLogo />

        <div className="flex items-center gap-2.5 flex-wrap">
          <ProjectSelectorBar />
          <RoleModeSwitcher />
          {!isInstalled && (
            <button
              type="button"
              onClick={triggerInstall}
              title={locale === 'br' ? 'Instalar aplicativo' : "Installer l'application"}
              className="h-9 px-2.5 cordel-btn font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer rounded transition-transform active:scale-95"
            >
              <span>📲</span>
              <span>{t('pwaInstallBtn') || (locale === 'br' ? 'Instalar' : 'Installer')}</span>
            </button>
          )}
          <div className="h-9 cordel-card-sm inline-flex items-center p-0.5 text-xs font-mono select-none">
            <button
              type="button" onClick={() => setLocale('fr')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer rounded ${
                locale === 'fr' ? 'bg-theme-wood text-[var(--cordel-on-primary)] font-black shadow-sm' : 'opacity-60 hover:opacity-100 text-theme-ink'
              }`}
              title="Francais"
            >
              FR
            </button>
            <button
              type="button" onClick={() => setLocale('br')}
              className={`h-full px-2.5 font-bold transition-all flex items-center justify-center cursor-pointer rounded ${
                locale === 'br' ? 'bg-theme-wood text-[var(--cordel-on-primary)] font-black shadow-sm' : 'opacity-60 hover:opacity-100 text-theme-ink'
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

          <UserAvatarMenu isInstalled={isInstalled} onInstall={triggerInstall} />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start w-full max-w-none">
        <MainLivretNavbar />
        <LivretContentRenderer />
      </main>
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <LanguageProvider>
      <ToadaProjectProvider>
        <AudioHardwareProvider>
          <AppContent />
          <CordelDialogModal />
          <AppUpdateBanner />
        </AudioHardwareProvider>
      </ToadaProjectProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
