/**
 * MidiConnectionBadge.tsx
 * Temoin discret Cordel de connexion MIDI dans l'en-tete (< 40 lignes).
 */
import React from 'react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';

export const MidiConnectionBadge: React.FC = () => {
  const { isMidiConnected, activeMidiDeviceName } = useVocalTransportStore();
  const { t } = useLanguage();

  if (!isMidiConnected) return null;

  return (
    <div
      className="h-9 cordel-card-sm px-2.5 inline-flex items-center gap-1.5 text-xs font-mono font-bold select-none text-emerald-400 border border-emerald-500/40 bg-emerald-950/30"
      title={t('midiConnectedTitle', { device: activeMidiDeviceName || 'MIDI Controller' })}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>🎹 {t('midiBadge')}</span>
    </div>
  );
};
