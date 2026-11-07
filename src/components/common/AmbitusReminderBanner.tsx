/**
 * AmbitusReminderBanner.tsx
 * Bandeau Cordel bienveillant rappelant de calibrer l'Ambitus vocal (Livret 5 — Mon Ambitus)
 * pour éliminer les sauts d'octave et fiabiliser la reconnaissance des notes (< 90 lignes).
 */
import React, { useState, useEffect } from 'react';
import { Sliders, ArrowRight, X } from 'lucide-react';
import { hasSavedAmbitusProfile } from '../../utils/ambitusStorage';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';

export const AMBITUS_REMINDER_DISMISSED_KEY = 'vocal_lab_ambitus_reminder_dismissed';

export const AmbitusReminderBanner: React.FC = () => {
  const { language } = useLanguage(), isBr = language === 'br';
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const setTreinoSubTab = useVocalTransportStore((s) => s.setTreinoSubTab);

  const [hasProfile, setHasProfile] = useState<boolean>(() => hasSavedAmbitusProfile());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AMBITUS_REMINDER_DISMISSED_KEY) === '1';
    } catch { return false; }
  });

  useEffect(() => {
    const sync = () => setHasProfile(hasSavedAmbitusProfile());
    window.addEventListener('ogirador-ambitus-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ogirador-ambitus-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (hasProfile || isDismissed) return null;

  const handleCalibrate = () => {
    setTreinoSubTab('ambitus');
    setActiveLivret('treino');
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AMBITUS_REMINDER_DISMISSED_KEY, '1');
    } catch {}
  };

  return (
    <div className="cordel-card px-3 py-2 rounded border border-amber-500/60 bg-amber-500/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
      <div className="flex items-center gap-2 text-theme-ink flex-1 min-w-[240px]">
        <Sliders className="w-4 h-4 text-[#9a3412] dark:text-amber-300 shrink-0" />
        <span>
          <strong className="text-[#9a3412] dark:text-amber-300">
            {isBr ? 'Ambitus vocal não calibrado — ' : 'Ambitus vocal non calibré — '}
          </strong>
          {isBr
            ? 'Fazer o teste de Ambitus (30s) permite ao Cantador conhecer sua tessitura para eliminar saltos de oitava e tornar o reconhecimento de notas mais confiável.'
            : "Faire le test d'Ambitus (30s) permet à Cantador de connaître votre tessiture pour éliminer les sauts d'octave et fiabiliser la reconnaissance des notes."}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleCalibrate}
          className="px-2.5 py-1 rounded bg-[#9a3412] hover:opacity-90 text-white font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <span>{isBr ? 'Calibrar meu Ambitus' : 'Calibrer mon Ambitus'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-2 py-1 rounded cordel-card-sm text-[11px] font-bold flex items-center gap-1 opacity-75 hover:opacity-100 cursor-pointer"
        >
          <X className="w-3 h-3" />
          <span>{isBr ? 'Mais tarde' : 'Plus tard'}</span>
        </button>
      </div>
    </div>
  );
};

