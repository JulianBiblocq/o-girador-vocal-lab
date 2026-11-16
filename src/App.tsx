/**
 * App.tsx
 * Point d'entrée O Girador — Cantador : CompactStudioHeader + BandeirolasNavbar + Page Élève dédiée (< 110 lignes).
 */
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { ToadaProjectProvider, useToadaProject } from './context/ToadaProjectContext';
import { AudioHardwareProvider } from './context/AudioHardwareContext';
import { CompactStudioHeader } from './components/header/CompactStudioHeader';
import { BandeirolasNavbar } from './components/navigation/BandeirolasNavbar';
import { LivretContentRenderer } from './components/navigation/LivretContentRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CordelDialogModal } from './components/ui/CordelDialogModal';
import { AppUpdateBanner } from './components/common/AppUpdateBanner';
import { MestreNoteDictationModal } from './components/dictation/MestreNoteDictationModal';
import { useGlobalTransportShortcuts } from './hooks/useGlobalTransportShortcuts';
import { useVocalLabMidi } from './hooks/useVocalLabMidi';
import { usePwaInstall } from './hooks/usePwaInstall';

const AppContent: React.FC = () => {
  useGlobalTransportShortcuts();
  useVocalLabMidi();
  const { locale } = useLanguage();
  const { isInstalled, triggerInstall } = usePwaInstall(locale);
  const { project, setActivePatternId } = useToadaProject();

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
    const onStepPattern = (e: Event) => {
      const delta = (e as CustomEvent<{ delta: number }>).detail?.delta || 0;
      if (!delta || project.patterns.length <= 1) return;
      const curIdx = Math.max(0, project.patterns.findIndex((p) => p.id === project.activePatternId));
      const nextIdx = (curIdx + delta + project.patterns.length) % project.patterns.length;
      if (project.patterns[nextIdx]) setActivePatternId(project.patterns[nextIdx].id);
    };
    window.addEventListener('contextmenu', blockContextMenu);
    window.addEventListener('cordel-step-pattern', onStepPattern);
    return () => {
      window.removeEventListener('contextmenu', blockContextMenu);
      window.removeEventListener('cordel-step-pattern', onStepPattern);
    };
  }, [project.patterns, project.activePatternId, setActivePatternId]);

  return (
    <div className="relative min-h-screen bg-theme-bg text-theme-ink flex flex-col px-2.5 sm:px-5 md:px-8 py-2.5 sm:py-4 transition-colors duration-200 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 wallpaper-surface-bg" aria-hidden="true" />
      <div className="relative z-40 w-full max-w-[1440px] mx-auto">
        <CompactStudioHeader
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          isInstalled={isInstalled}
          onTriggerInstall={triggerInstall}
        />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start w-full max-w-[1440px] mx-auto pb-8">
        <BandeirolasNavbar />
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
          <MestreNoteDictationModal />
          <CordelDialogModal />
          <AppUpdateBanner />
        </AudioHardwareProvider>
      </ToadaProjectProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
