/**
 * AppUpdateBanner.tsx
 * Bandeau non-bloquant d'actualisation de version en style Cordel (< 60 lignes).
 */
import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { useLanguage } from '../../i18n/LanguageContext';

export const AppUpdateBanner: React.FC = () => {
  const { updateAvailable, reloadApp, dismissUpdate } = useAppUpdate();
  const { locale } = useLanguage();

  if (!updateAvailable) return null;

  const isBr = locale === 'br';
  const message = isBr ? 'Nova versão do Cantador disponível' : 'Nouvelle version de Cantador disponible';
  const updateLabel = isBr ? 'Atualizar' : 'Actualiser';

  return (
    <aside
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] sm:max-w-md bg-[#f4ecd8] text-[#1a1a1a] border-2 border-[#9a3412] px-4 py-2.5 shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-between gap-3 animate-bounce-short font-mono text-xs select-none"
    >
      <div className="flex items-center gap-2 font-bold tracking-tight">
        <RefreshCw className="w-4 h-4 text-[#9a3412] shrink-0 animate-spin-slow" />
        <span>{message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={reloadApp}
          className="bg-[#9a3412] hover:bg-[#7c2d12] text-[#f4ecd8] px-3 py-1 font-black uppercase tracking-wider text-[11px] shadow-[2px_2px_0px_#1a1a1a] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          [ {updateLabel} ]
        </button>
        <button
          type="button"
          onClick={dismissUpdate}
          aria-label="Fermer"
          className="p-1 text-[#1a1a1a] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
