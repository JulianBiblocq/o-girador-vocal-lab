/**
 * MidiConnectionBadge.tsx
 * Témoin discret Cordel de connexion MIDI avec contraste Jour/Nuit (< 35 lignes).
 */
import React from 'react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { Piano } from 'lucide-react';

export const MidiConnectionBadge: React.FC = () => {
  const isMidiConnected = useVocalTransportStore((s) => s.isMidiConnected);
  const activeMidiDeviceName = useVocalTransportStore((s) => s.activeMidiDeviceName);
  const { t } = useLanguage();

  if (!isMidiConnected) return null;

  return (
    <div
      className="h-8 cordel-card-sm px-2 inline-flex items-center gap-1.5 text-[11px] font-mono font-bold select-none text-emerald-800 dark:text-emerald-300 border border-emerald-600/50 bg-emerald-500/15"
      title={t('midiConnectedTitle', { device: activeMidiDeviceName || 'MIDI Controller' })}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
      <Piano className="w-3.5 h-3.5" />
      <span>{t('midiBadge')}</span>
    </div>
  );
};
