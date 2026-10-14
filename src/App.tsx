import React, { useState } from 'react';
import { LivretPrise } from './components/livret-prise/LivretPrise';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mic, Sun, Moon, Radio } from 'lucide-react';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-theme-bg text-theme-ink flex flex-col p-4 md:p-6 transition-colors duration-200">
        {/* Header Cordel */}
        <header className="max-w-2xl mx-auto w-full mb-6 cordel-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 cordel-card-sm bg-theme-wood text-theme-ink">
              <Mic className="w-6 h-6 text-theme-accent" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-widest uppercase m-0 leading-tight">
                O Girador • Vocal Lab
              </h1>
              <p className="text-xs font-mono opacity-70 m-0">
                Horloge 60 FPS • Métronome Accordé • Balancier Cinématique
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 cordel-card-sm text-[11px] font-mono">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Port 5177</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="cordel-btn p-2 text-xs flex items-center justify-center cursor-pointer"
              title="Changer de thème (Clair / Sombre)"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-theme-accent" />
              ) : (
                <Moon className="w-4 h-4 text-theme-wood" />
              )}
            </button>
          </div>
        </header>

        {/* Corps principal : Livret 1 (Prise & Balancier) */}
        <main className="flex-1 flex flex-col items-center justify-center">
          <LivretPrise />
        </main>

        {/* Footer informatif */}
        <footer className="max-w-2xl mx-auto w-full mt-6 text-center text-xs font-mono opacity-60 flex flex-col gap-1">
          <div>O Girador Vocal Lab • Bac à sable étanche • Zéro collision avec Sequenciador</div>
          <div>Standard VocalPackExport v1.0 • Puxador / Coro</div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default App;
