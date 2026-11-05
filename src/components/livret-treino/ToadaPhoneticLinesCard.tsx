/**
 * ToadaPhoneticLinesCard.tsx
 * Phrases de la Toada (parolesOriginales + parolesPhonetiques), écoute découpée du Mestre (100% / 🐢 75% WSOLA)
 * et Miroir Audio [ 🎙️ S'enregistrer & Comparer (Mestre ➔ Moi) ] (< 120 lignes).
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { PronunciationMirrorEngine } from '../../audio/pronunciationMirrorEngine';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { wordMatchesSoundCard, formatNaturalPhoneticLine, type SoundCardId } from '../../data/portugueseSoundCards';
import { Volume2, Square, Mic } from 'lucide-react';

export interface ToadaPhraseEntry {
  id: string;
  roleLabel: string;
  originalText: string;
  phoneticText: string;
  pattern?: VocalPatternItem;
}

interface Props {
  phrases: ToadaPhraseEntry[];
  activeCardId: SoundCardId | null;
}

export const ToadaPhoneticLinesCard: React.FC<Props> = ({ phrases, activeCardId }) => {
  const { t } = useLanguage();
  const { selectedDeviceId } = useAudioHardware();
  const engine = useMemo(() => new PronunciationMirrorEngine(), []);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [mirrorState, setMirrorState] = useState<{ phraseId: string; phase: 'recording' | 'mirroring' } | null>(null);

  const stopAll = useCallback(() => {
    engine.stop();
    setPlayingKey(null);
    setMirrorState(null);
  }, [engine]);

  useEffect(() => {
    const unregister = registerTreinoKillSwitch(stopAll);
    return () => { unregister(); stopAll(); };
  }, [stopAll]);

  const handlePlayPhrase = useCallback(async (phrase: ToadaPhraseEntry, speed: 100 | 75) => {
    const key = `${phrase.id}_${speed}`;
    if (playingKey === key) { stopAll(); return; }
    stopAll();
    setPlayingKey(key);
    await engine.playPhrase(phrase.pattern, phrase.originalText, speed, () => setPlayingKey(null));
  }, [playingKey, stopAll, engine]);

  const handleMirrorPhrase = useCallback(async (phrase: ToadaPhraseEntry) => {
    if (mirrorState?.phraseId === phrase.id) { stopAll(); return; }
    stopAll();
    await engine.recordAndMirror(phrase.pattern, phrase.originalText, selectedDeviceId, (phase) => {
      if (phase === 'idle') setMirrorState(null);
      else setMirrorState({ phraseId: phrase.id, phase });
    });
  }, [mirrorState, stopAll, engine, selectedDeviceId]);

  return (
    <div className="cordel-card p-4 space-y-3">
      <h4 className="font-bold text-xs tracking-wider uppercase border-b border-[var(--cordel-border-sub)] pb-1.5 text-[var(--cordel-text)]">{t('toadaPhoneticsSectionTitle')}</h4>
      <div className="space-y-3">
        {phrases.map((ph) => {
          const isMirrorActive = mirrorState?.phraseId === ph.id;
          return (
            <div key={ph.id} className="cordel-card-sm p-3 space-y-2 rounded">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded text-[#f4ecd8] ${ph.roleLabel.toLowerCase().includes('puxador') ? 'bg-role-puxador' : 'bg-role-coro'}`}>
                  {ph.roleLabel}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([100, 75] as const).map((spd) => {
                    const isActive = playingKey === `${ph.id}_${spd}`;
                    return (
                      <button
                        key={spd} type="button" onClick={() => handlePlayPhrase(ph, spd)}
                        className={`cordel-btn px-2.5 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer ${isActive ? 'bg-[#c25e38] text-white border-[#c25e38]' : ''}`}
                      >
                        {isActive ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        <span>{isActive ? t('stopMestreBtn') : spd === 100 ? t('listenMestre100Btn') : t('listenMestre75Btn')}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button" onClick={() => handleMirrorPhrase(ph)}
                    className={`cordel-btn px-2.5 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer ${
                      isMirrorActive ? 'bg-red-800 text-white animate-pulse' : 'text-theme-accent'
                    }`}
                  >
                    {isMirrorActive ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
                    <span>
                      {isMirrorActive
                        ? (mirrorState?.phase === 'recording' ? t('pronunciationMirrorRecording') : t('pronunciationMirrorPlaying'))
                        : t('pronunciationMirrorBtn')}
                    </span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded">
                  <span className="block text-[10px] font-bold uppercase text-[var(--cordel-secondary-text)] mb-0.5">{t('toadaOrigLabel')}</span>
                  <p className="font-serif text-sm leading-relaxed flex flex-wrap gap-x-1">
                    {ph.originalText.split(/\s+/).map((word, wIdx) => (
                      <span key={wIdx} className={wordMatchesSoundCard(word, activeCardId) ? 'bg-[var(--cordel-coro)] text-white font-bold px-1 rounded' : ''}>{word}</span>
                    ))}
                  </p>
                </div>
                <div className="p-2 bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded">
                  <span className="block text-[10px] font-bold uppercase text-[var(--cordel-secondary-text)] mb-0.5">{t('toadaPhonLabel')}</span>
                  <p className="font-mono text-sm text-[#9a3412] dark:text-[#f4a261] leading-relaxed">{formatNaturalPhoneticLine(ph.phoneticText)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
