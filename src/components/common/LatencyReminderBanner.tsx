/**
 * LatencyReminderBanner.tsx
 * Bandeau de rappel bienveillant pour le calage de latence (< 75 lignes).
 * Vérifie si le périphérique d'entrée est déjà calibré dans localStorage.
 */
import React, { useState, useEffect } from 'react';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import {
  isLatencyCalibrated,
  markLatencyCalibrated,
  isLatencyReminderDismissedSession,
  dismissLatencyReminderSession,
} from '../../utils/latencyStorage';
import { Clock, Settings, Check, X } from 'lucide-react';

export const LatencyReminderBanner: React.FC = () => {
  const { selectedDeviceId } = useAudioHardware();
  const { setActiveLivret } = useVocalTransportStore();
  const [hidden, setHidden] = useState<boolean>(() => (
    isLatencyCalibrated(selectedDeviceId) || isLatencyReminderDismissedSession()
  ));

  useEffect(() => {
    const isCalibrated = isLatencyCalibrated(selectedDeviceId);
    const isDismissed = isLatencyReminderDismissedSession();
    setHidden(isCalibrated || isDismissed);

    const onCalibrated = () => setHidden(true);
    const onDismissed = () => setHidden(true);
    window.addEventListener('ogirador-latency-calibrated', onCalibrated);
    window.addEventListener('ogirador-latency-dismissed', onDismissed);
    return () => {
      window.removeEventListener('ogirador-latency-calibrated', onCalibrated);
      window.removeEventListener('ogirador-latency-dismissed', onDismissed);
    };
  }, [selectedDeviceId]);

  if (hidden) return null;

  const handleMarkCalibrated = () => {
    markLatencyCalibrated(selectedDeviceId);
    setHidden(true);
  };

  const handleDismiss = () => {
    dismissLatencyReminderSession();
    setHidden(true);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-mono rounded shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="truncate">
          ⏱️ Avant d&apos;enregistrer, pensez à vérifier le calage de latence de votre micro/carte son dans les Réglages.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveLivret('reglages')}
          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded flex items-center gap-1 font-bold text-[11px] cursor-pointer"
        >
          <Settings className="w-3 h-3" />
          <span>⚙️ Aller aux Réglages</span>
        </button>

        <button
          type="button"
          onClick={handleMarkCalibrated}
          className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1 text-[11px] cursor-pointer"
          title="Marquer ce micro comme calibré"
        >
          <Check className="w-3 h-3" />
          <span>✓ C&apos;est déjà calé</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 hover:text-white text-amber-400 cursor-pointer"
          title="Masquer pour cette session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
