/**
 * ToadaLexiconModal.tsx
 * Modale Cordel d'extraction, enrichissement bilingue et génération de quiz (< 140 lignes).
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ToadaLexiconEntry } from '../../types/toadaLexicon.types';
import { ORGANIZADOR_VOCAL_LEXICON } from '../../i18n/lexicon';
import { detectToadaLexicon } from '../../utils/toadaLexiconDetector';
import { generateQuizFromLexicon } from '../../utils/toadaQuizGenerator';
import { ToadaLexiconItemRow } from './ToadaLexiconItemRow';
import { BookOpen, Sparkles, X, Plus, HelpCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const ToadaLexiconModal: React.FC<Props> = ({ isOpen, onClose, isReadOnly }) => {
  const { project, updateToadaMeta } = useToadaProject();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'toada' | 'catalog'>('toada');
  const [newTerm, setNewTerm] = useState('');
  const [newTrad, setNewTrad] = useState('');

  const toadaEntries = useMemo(() => project.toadaMeta?.notesLexique || [], [project.toadaMeta]);

  const handleAutoDetect = useCallback(() => {
    const detected = detectToadaLexicon(project);
    updateToadaMeta({ notesLexique: detected });
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'success', message: t('lexiconDetectedCountToast', { count: detected.length }) },
      })
    );
  }, [project, updateToadaMeta, t]);

  const handleGenerateQuiz = useCallback(() => {
    const list = toadaEntries.length > 0 ? toadaEntries : detectToadaLexicon(project);
    const quizItems = generateQuizFromLexicon(list);
    updateToadaMeta({ notesLexique: list, questionsQcm: quizItems });
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'success', message: t('lexiconQuizGeneratedToast', { count: quizItems.length }) },
      })
    );
  }, [toadaEntries, project, updateToadaMeta, t]);

  const handleAddManual = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newTrad.trim()) return;
    const item: ToadaLexiconEntry = {
      mot: newTerm.trim(),
      traductionFr: newTrad.trim(),
      explication: `${newTrad.trim()}`,
      categorie: 'maracatu',
    };
    updateToadaMeta({ notesLexique: [...toadaEntries, item] });
    setNewTerm(''); setNewTrad('');
  }, [newTerm, newTrad, toadaEntries, updateToadaMeta]);

  const handleDelete = useCallback((mot: string) => {
    updateToadaMeta({ notesLexique: toadaEntries.filter((e) => e.mot.toLowerCase() !== mot.toLowerCase()) });
  }, [toadaEntries, updateToadaMeta]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-center p-3 font-mono">
      <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_#000] w-full max-w-3xl max-h-[90vh] flex flex-col text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none">
        <div className="p-3 border-b-2 border-[#1a1a1a] bg-[#f5edd6] dark:bg-[#2b2722] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#8b2a1a] dark:text-[#f4a261]" />
            <h3 className="font-bold text-sm uppercase tracking-wider">{t('lexiconModalTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 bg-[#1a1a1a] text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-3 border-b border-[#1a1a1a]/20 flex flex-wrap items-center justify-between gap-2 bg-[#f0ebd9] dark:bg-[#26231e]">
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveTab('toada')} className={`px-3 py-1 text-xs font-bold border border-[#1a1a1a] cursor-pointer ${activeTab === 'toada' ? 'bg-[#8b2a1a] text-white' : 'bg-[#fcfaf2] dark:bg-[#1f1d1a]'}`}>
              {t('lexiconToadaTermsTab')} ({toadaEntries.length})
            </button>
            <button type="button" onClick={() => setActiveTab('catalog')} className={`px-3 py-1 text-xs font-bold border border-[#1a1a1a] cursor-pointer ${activeTab === 'catalog' ? 'bg-[#8b2a1a] text-white' : 'bg-[#fcfaf2] dark:bg-[#1f1d1a]'}`}>
              {t('lexiconAllTermsTab')} ({ORGANIZADOR_VOCAL_LEXICON.length})
            </button>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleAutoDetect} className="px-2.5 py-1 text-xs font-bold bg-[#2a9d8f] text-white border border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center gap-1 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" /><span>{t('lexiconDetectBtn')}</span>
              </button>
              <button type="button" onClick={handleGenerateQuiz} className="px-2.5 py-1 text-xs font-bold bg-[#d97706] text-white border border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center gap-1 cursor-pointer">
                <HelpCircle className="w-3.5 h-3.5" /><span>Quiz Organizador</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-2">
          {activeTab === 'toada' ? (
            toadaEntries.length === 0 ? (
              <p className="p-4 text-xs italic text-center opacity-70 bg-[#f5edd6] dark:bg-[#2b2722] border border-[#1a1a1a]/20">{t('lexiconEmptyNotice')}</p>
            ) : (
              toadaEntries.map((e, idx) => <ToadaLexiconItemRow key={`${e.mot}_${idx}`} entry={e} onDelete={handleDelete} isReadOnly={isReadOnly} />)
            )
          ) : (
            ORGANIZADOR_VOCAL_LEXICON.map((l) => (
              <ToadaLexiconItemRow key={l.id} entry={{ mot: l.br, traductionFr: l.fr, explication: l.fr, phonetique: l.phonetique, conseilDiction: l.conseilDiction, soundCardId: l.soundCardId, categorie: l.category }} isReadOnly />
            ))
          )}
        </div>

        {!isReadOnly && activeTab === 'toada' && (
          <form onSubmit={handleAddManual} className="p-2.5 border-t-2 border-[#1a1a1a] bg-[#f5edd6] dark:bg-[#2b2722] flex flex-wrap gap-2 text-xs">
            <input type="text" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Terme BR (ex: Gonguê)" className="px-2 py-1 bg-white dark:bg-[#1f1d1a] border border-[#1a1a1a] flex-1 min-w-[140px]" />
            <input type="text" value={newTrad} onChange={(e) => setNewTrad(e.target.value)} placeholder="Traduction FR (ex: Cloche de fer)" className="px-2 py-1 bg-white dark:bg-[#1f1d1a] border border-[#1a1a1a] flex-1 min-w-[140px]" />
            <button type="submit" className="px-3 py-1 bg-[#1a1a1a] text-[#f4ecd8] font-bold border border-[#1a1a1a] shadow-[2px_2px_0px_#000] flex items-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /><span>{t('lexiconAddTermBtn')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
