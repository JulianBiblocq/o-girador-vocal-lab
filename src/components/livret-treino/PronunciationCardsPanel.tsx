/**
 * PronunciationCardsPanel.tsx
 * Atelier 3 : Les 6 Cartes Sonores du Portugais Chanté, Paroles & Phonétique naturelle et Lexique.
 * Strictement < 130 lignes.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { PORTUGUESE_SOUND_CARDS, countMatchingWordsInLines, type SoundCardId } from '../../data/portugueseSoundCards';
import { ToadaPhoneticLinesCard, type ToadaPhraseEntry } from './ToadaPhoneticLinesCard';
import { CulturalInsightCard } from './CulturalInsightCard';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { Volume2 } from 'lucide-react';

const DEFAULT_DEMO_PHRASES: ToadaPhraseEntry[] = [
  {
    id: 'demo-pux',
    roleLabel: 'PUXADOR — Appel',
    originalText: 'Nagô chegou na terra com fé e axé de Xangô e Oxum',
    phoneticText: 'Na-gô che-gôou na tèr-ra côm fé i a-ché dji Chan-gô i O-choun',
  },
  {
    id: 'demo-coro',
    roleLabel: 'CORO — Réponse',
    originalText: 'A Rainha da Nação e o Puxador chegaram no baque virado com o coro',
    phoneticText: 'A Ra-i-gna da Na-ssa-oun i ou Pou-cha-dôr che-ga-ra-oun nou ba-qui vi-ra-dou côm ou cô-rou',
  },
];

export const PronunciationCardsPanel: React.FC = () => {
  const { t } = useLanguage();
  const { project } = useToadaProject();
  const [activeCardId, setActiveCardId] = useState<SoundCardId | null>('ao_am');

  useEffect(() => {
    return registerTreinoKillSwitch(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    });
  }, []);

  const phrases: ToadaPhraseEntry[] = useMemo(() => {
    const list: ToadaPhraseEntry[] = [];
    for (const pat of project.patterns) {
      const stepLyrics = [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])]
        .filter((s) => s.active && s.syllable)
        .map((s) => s.syllable)
        .join(' ').trim();
      const orig = (pat.assignedLyricsText || stepLyrics).trim();
      if (orig) {
        list.push({
          id: pat.id, roleLabel: `${pat.role.toUpperCase()} — ${pat.name}`,
          originalText: orig, phoneticText: (pat.assignedPhoneticText || orig).trim(), pattern: pat,
        });
      }
    }
    const meta = project.toadaMeta;
    if (list.length === 0 && meta?.parolesOriginales && typeof meta.parolesOriginales === 'string') {
      const origLines = meta.parolesOriginales.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const phonLines = typeof meta.parolesPhonetiques === 'string' ? meta.parolesPhonetiques.split(/\r?\n/) : [];
      origLines.forEach((line, idx) => {
        list.push({
          id: `meta-${idx}`, roleLabel: idx % 2 === 0 ? 'PUXADOR' : 'CORO',
          originalText: line.trim(), phoneticText: (phonLines[idx] || line).trim(),
        });
      });
    }
    return list.length > 0 ? list : DEFAULT_DEMO_PHRASES;
  }, [project]);

  const matchCount = useMemo(
    () => countMatchingWordsInLines(phrases.map((p) => p.originalText), activeCardId),
    [phrases, activeCardId]
  );

  const handleSpeakSample = useCallback((sample: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(sample);
    utt.lang = 'pt-BR'; utt.rate = 0.82;
    window.speechSynthesis.speak(utt);
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a]/20 pb-2">
          <div>
            <h3 className="font-bold text-sm tracking-wider uppercase">{t('soundCardsSectionTitle')}</h3>
            <p className="text-[11px] opacity-80">{t('soundCardsSubtitle')}</p>
          </div>
          {activeCardId && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-[#2a9d8f] text-white border border-[#1a1a1a]">{t('soundCardMatchesBadge', { n: matchCount })}</span>
              <button type="button" onClick={() => setActiveCardId(null)} className="px-2 py-1 text-xs font-bold border border-[#1a1a1a] bg-[#f4ecd8] dark:bg-[#2b2722] cursor-pointer">{t('soundCardClearFilterBtn')}</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PORTUGUESE_SOUND_CARDS.map((card) => {
            const isSelected = activeCardId === card.id;
            return (
              <div key={card.id} onClick={() => setActiveCardId(isSelected ? null : card.id)} className={`p-3 border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] rounded-none cursor-pointer transition-transform ${isSelected ? 'bg-[#2a9d8f]/15 -translate-y-0.5' : 'bg-[#f5edd6] dark:bg-[#2b2722]'}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs text-[#8b2a1a] dark:text-[#f4a261]">{t(card.titleKey)}</span>
                  <button type="button" onClick={(e) => handleSpeakSample(card.speechSample, e)} className="px-2 py-0.5 text-[10px] font-bold bg-[#1a1a1a] text-[#f4ecd8] flex items-center gap-1 cursor-pointer"><Volume2 className="w-3 h-3" /><span>{t('soundCardListenBtn')}</span></button>
                </div>
                <p className="text-[11px] leading-relaxed mb-2 opacity-90">{t(card.ruleKey)}</p>
                <div className="flex flex-wrap gap-1">
                  {card.examples.map((ex) => <span key={ex} className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#fcfaf2] dark:bg-[#1f1d1a] border border-[#1a1a1a]/30">{ex}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ToadaPhoneticLinesCard phrases={phrases} activeCardId={activeCardId} />
      <CulturalInsightCard />
    </div>
  );
};
