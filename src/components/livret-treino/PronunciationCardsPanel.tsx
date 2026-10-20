/**
 * PronunciationCardsPanel.tsx
 * Atelier 3 : Les 6 Cartes Sonores du Portugais Chanté, Vocabulaire Actif & Lexique (< 135 lignes).
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { PORTUGUESE_SOUND_CARDS, countMatchingWordsInLines, type SoundCardId } from '../../data/portugueseSoundCards';
import { ToadaPhoneticLinesCard, type ToadaPhraseEntry } from './ToadaPhoneticLinesCard';
import { CulturalInsightCard } from './CulturalInsightCard';
import { ActiveToadaLexiconStrip } from './ActiveToadaLexiconStrip';
import { SoundCardItem } from './SoundCardItem';
import { ToadaLexiconModal } from '../lexicon/ToadaLexiconModal';
import { detectToadaLexicon } from '../../utils/toadaLexiconDetector';
import { registerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';

const DEFAULT_DEMO_PHRASES: ToadaPhraseEntry[] = [
  { id: 'demo-pux', roleLabel: 'PUXADOR — Appel', originalText: 'Nagô chegou na terra com fé e axé de Xangô e Oxum', phoneticText: 'Na-gô che-gôou na tèr-ra côm fé i a-ché dji Chan-gô i O-choun' },
  { id: 'demo-coro', roleLabel: 'CORO — Réponse', originalText: 'A Rainha da Nação e o Puxador chegaram no baque virado com o coro', phoneticText: 'A Ra-i-gna da Na-ssa-oun i ou Pou-cha-dôr che-ga-ra-oun nou ba-qui vi-ra-dou côm ou cô-rou' },
];

export const PronunciationCardsPanel: React.FC = () => {
  const { t } = useLanguage();
  const { project } = useToadaProject();
  const [activeCardId, setActiveCardId] = useState<SoundCardId | null>(null);
  const [showOnlySongCards, setShowOnlySongCards] = useState(false);
  const [isLexiconModalOpen, setIsLexiconModalOpen] = useState(false);

  useEffect(() => registerTreinoKillSwitch(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) try { window.speechSynthesis.cancel(); } catch {}
  }), []);

  const phrases: ToadaPhraseEntry[] = useMemo(() => {
    const list: ToadaPhraseEntry[] = [];
    for (const pat of project.patterns) {
      const stepLyrics = [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])]
        .filter((s) => s.active && s.syllable).map((s) => s.syllable).join(' ').trim();
      const orig = (pat.assignedLyricsText || stepLyrics).trim();
      if (orig) list.push({ id: pat.id, roleLabel: `${pat.role.toUpperCase()} — ${pat.name}`, originalText: orig, phoneticText: (pat.assignedPhoneticText || orig).trim(), pattern: pat });
    }
    const meta = project.toadaMeta;
    if (list.length === 0 && meta?.parolesOriginales && typeof meta.parolesOriginales === 'string') {
      const origLines = meta.parolesOriginales.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const phonLines = typeof meta.parolesPhonetiques === 'string' ? meta.parolesPhonetiques.split(/\r?\n/) : [];
      origLines.forEach((line, idx) => list.push({ id: `meta-${idx}`, roleLabel: idx % 2 === 0 ? 'PUXADOR' : 'CORO', originalText: line.trim(), phoneticText: (phonLines[idx] || line).trim() }));
    }
    return list.length > 0 ? list : DEFAULT_DEMO_PHRASES;
  }, [project]);

  const activeLexicon = useMemo(() => {
    const saved = project.toadaMeta?.notesLexique || [];
    return saved.length > 0 ? saved : detectToadaLexicon(project);
  }, [project]);

  const cardMatches = useMemo(() => {
    const lines = phrases.map((p) => p.originalText);
    const map = {} as Record<SoundCardId, number>;
    for (const c of PORTUGUESE_SOUND_CARDS) map[c.id] = countMatchingWordsInLines(lines, c.id);
    return map;
  }, [phrases]);

  const displayedCards = useMemo(() => {
    if (!showOnlySongCards) return PORTUGUESE_SOUND_CARDS;
    const filtered = PORTUGUESE_SOUND_CARDS.filter((c) => (cardMatches[c.id] || 0) > 0);
    return filtered.length > 0 ? filtered : PORTUGUESE_SOUND_CARDS;
  }, [showOnlySongCards, cardMatches]);

  const handleSpeakSample = useCallback((sample: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(sample);
    utt.lang = 'pt-BR'; utt.rate = 0.82;
    window.speechSynthesis.speak(utt);
  }, []);

  return (
    <div className="space-y-4 font-mono">
      <ActiveToadaLexiconStrip entries={activeLexicon} activeCardId={activeCardId} onSelectCard={setActiveCardId} onOpenLexiconModal={() => setIsLexiconModalOpen(true)} />

      <div className="cordel-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-2">
          <div>
            <h3 className="font-bold text-sm tracking-wider uppercase text-[var(--cordel-text)]">{t('soundCardsSectionTitle')}</h3>
            <p className="text-[11px] text-[var(--cordel-secondary-text)]">{t('soundCardsSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlySongCards((prev) => !prev)}
              className={`cordel-btn px-2.5 py-1 text-xs rounded cursor-pointer ${showOnlySongCards ? 'bg-[var(--cordel-coro)] text-[#f4ecd8] border-[var(--cordel-coro)]' : ''}`}
            >
              {showOnlySongCards ? '⭐ Dans ce chant' : '📚 Toutes les cartes (6)'}
            </button>
            {activeCardId && (
              <button
                type="button"
                onClick={() => setActiveCardId(null)}
                className="cordel-btn px-2 py-1 text-xs rounded bg-[#9a3412] text-[#f4ecd8] border-[#9a3412] cursor-pointer"
              >
                ✕ Retirer filtre
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedCards.map((card) => (
            <SoundCardItem key={card.id} card={card} isSelected={activeCardId === card.id} matchCount={cardMatches[card.id] || 0} titleText={t(card.titleKey)} ruleText={t(card.ruleKey)} onSelect={(id) => setActiveCardId(activeCardId === id ? null : id)} onSpeak={handleSpeakSample} />
          ))}
        </div>
      </div>

      <ToadaPhoneticLinesCard phrases={phrases} activeCardId={activeCardId} />
      <CulturalInsightCard onOpenLexicon={() => setIsLexiconModalOpen(true)} />
      <ToadaLexiconModal isOpen={isLexiconModalOpen} onClose={() => setIsLexiconModalOpen(false)} />
    </div>
  );
};
