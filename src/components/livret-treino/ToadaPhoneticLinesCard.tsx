/**
 * ToadaPhoneticLinesCard.tsx
 * Affichage clair des phrases de la Toada (parolesOriginales + parolesPhonetiques sans majuscules toniques),
 * surlignage automatique selon la Carte Sonore active et écoute du Mestre à 100 % ou 75 % (WSOLA constant-pitch).
 * Strictement < 130 lignes.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { getSharedAudioContext } from '../../audio/sharedAudioContext';
import { wsolaStretchSegment } from '../../audio/piecewiseTimeWarper';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { wordMatchesSoundCard, formatNaturalPhoneticLine, type SoundCardId } from '../../data/portugueseSoundCards';
import { selectBestAudioVariant } from '../../utils/variantMatcher';
import { Volume2, Square } from 'lucide-react';

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
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); activeSourceRef.current.disconnect(); } catch { /* ignore */ }
      activeSourceRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    setPlayingKey(null);
  }, []);

  useEffect(() => {
    const unregister = registerTreinoKillSwitch(stopPlayback);
    return () => { unregister(); stopPlayback(); };
  }, [stopPlayback]);

  const playBuffer = useCallback(async (pcm: Float32Array, sampleRate: number) => {
    const ctx = await getSharedAudioContext();
    const buf = ctx.createBuffer(1, pcm.length, sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => setPlayingKey(null);
    activeSourceRef.current = src;
    src.start();
  }, []);

  const handlePlayPhrase = useCallback(async (phrase: ToadaPhraseEntry, speed: 100 | 75) => {
    const key = `${phrase.id}_${speed}`;
    if (playingKey === key) { stopPlayback(); return; }
    stopPlayback();
    setPlayingKey(key);

    const pat = phrase.pattern;
    const match = pat?.variants ? selectBestAudioVariant(pat.variants, speed / 100, 0, pat.baseBpm ?? 100) : null;
    const rec = match?.variant?.recordingResult ?? pat?.recordingResult ?? null;

    if (rec && rec.pcm.length > 0) {
      const pcm = (match && Math.abs(match.residualRate - 1.0) > 0.04)
        ? wsolaStretchSegment(rec.pcm, rec.sampleRate, Math.round(rec.pcm.length / match.residualRate))
        : rec.pcm;
      await playBuffer(pcm, rec.sampleRate);
      return;
    }
    if ('speechSynthesis' in window) {
      const utt = new SpeechSynthesisUtterance(phrase.originalText);
      utt.lang = 'pt-BR'; utt.rate = speed === 75 ? 0.75 : 1.0;
      utt.onend = () => setPlayingKey(null); utt.onerror = () => setPlayingKey(null);
      window.speechSynthesis.speak(utt);
    } else {
      setPlayingKey(null);
    }
  }, [playingKey, stopPlayback, playBuffer]);

  return (
    <div className="cordel-card p-4 space-y-3">
      <h4 className="font-bold text-xs tracking-wider uppercase border-b border-[var(--cordel-border-sub)] pb-1.5 text-[var(--cordel-text)]">{t('toadaPhoneticsSectionTitle')}</h4>
      <div className="space-y-3">
        {phrases.map((ph) => (
          <div key={ph.id} className="cordel-card-sm p-3 space-y-2 rounded">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded text-[#f4ecd8] ${ph.roleLabel.toLowerCase().includes('puxador') ? 'bg-role-puxador' : 'bg-role-coro'}`}>
                {ph.roleLabel}
              </span>
              <div className="flex items-center gap-1.5">
                {([100, 75] as const).map((spd) => {
                  const isActive = playingKey === `${ph.id}_${spd}`;
                  return (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handlePlayPhrase(ph, spd)}
                      className={`cordel-btn px-2.5 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer ${
                        isActive ? 'bg-[#c25e38] text-white border-[#c25e38]' : ''
                      }`}
                    >
                      {isActive ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{isActive ? t('stopMestreBtn') : spd === 100 ? t('listenMestre100Btn') : t('listenMestre75Btn')}</span>
                    </button>
                  );
                })}
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
        ))}
      </div>
    </div>
  );
};
