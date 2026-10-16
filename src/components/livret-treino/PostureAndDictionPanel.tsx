/**
 * PostureAndDictionPanel.tsx
 * Atelier Posture corporelle, Diction phonétique et Sens culturel.
 * Strictement < 150 lignes.
 */

import React, { useState, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { MARACATU_POSTURE_TIPS } from '../../data/maracatuVocalPostureTips';
import { CulturalInsightCard } from './CulturalInsightCard';
import { getSharedAudioContext } from '../../audio/sharedAudioContext';
import { Volume2, VolumeX } from 'lucide-react';

export const PostureAndDictionPanel: React.FC = () => {
  const { t, locale } = useLanguage();
  const { activePattern } = useToadaProject();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const textToSpeak = activePattern.assignedLyricsText || activePattern.assignedPhoneticText || 'Maracatu de Baque Virado';

  const handlePlayDiction = useCallback(async () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Déclenchement d'un clic témoin d'élan
    try {
      const ctx = await getSharedAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch { /* ignore */ }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.8;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [textToSpeak, isSpeaking]);

  return (
    <div className="space-y-6">
      {/* 1. Fiches de Posture Maracatu */}
      <div>
        <h3 className="font-bold text-sm tracking-wider uppercase mb-3 text-[#1a1a1a] dark:text-[#f4ecd8] border-b border-[#1a1a1a]/20 pb-1">
          {t('postureTabTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MARACATU_POSTURE_TIPS.map((tip) => (
            <div
              key={tip.id}
              className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] p-3 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none"
            >
              <div className="font-bold text-xs flex items-center gap-1.5 mb-1 text-[#8b2a1a] dark:text-[#f4a261]">
                <span>{tip.icon}</span>
                <span>{locale === 'br' ? tip.titleBr : tip.titleFr}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {locale === 'br' ? tip.descBr : tip.descFr}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Atelier Diction & Phonétique du Pattern Actif */}
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-3">
        <div className="flex items-center justify-between border-b border-[#1a1a1a]/20 pb-2">
          <span className="font-bold text-xs tracking-wider uppercase">
            🗣️ Diction : {activePattern.name} ({activePattern.role.toUpperCase()})
          </span>
          <button
            onClick={handlePlayDiction}
            className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] transition-all rounded-none ${
              isSpeaking
                ? 'bg-[#d97706] text-[#f4ecd8] hover:bg-[#b45309]'
                : 'bg-[#2a9d8f] text-[#f4ecd8] hover:bg-[#21867a]'
            }`}
          >
            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isSpeaking ? 'Arrêter la diction' : t('listenDictionBtn')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#f5edd6] dark:bg-[#2b2722] p-2.5 border border-[#1a1a1a]/20">
            <span className="font-bold text-[10px] opacity-75 uppercase block mb-1">Paroles (Letra)</span>
            <p className="font-serif italic text-sm">{activePattern.assignedLyricsText || '(Aucune parole assignée)'}</p>
          </div>
          <div className="bg-[#f0ebd9] dark:bg-[#26231e] p-2.5 border border-[#1a1a1a]/20">
            <span className="font-bold text-[10px] opacity-75 uppercase block mb-1">Phonétique chantée (Fonética)</span>
            <p className="font-mono text-sm text-[#8b2a1a] dark:text-[#f4a261]">
              {activePattern.assignedPhoneticText || activePattern.assignedLyricsText || '(Non renseigné)'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Carte Culturelle (Histoire, Lexique, Traduction) */}
      <CulturalInsightCard />
    </div>
  );
};
