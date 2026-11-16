/**
 * VocalPaperWorkshopModal.tsx
 * Modale principale « Atelier Papier du Chant » (Cantador) à 4 onglets avec contraste Jour / Nuit Cordel garanti :
 * 1. Imprimer Feuilles (5 modèles), 2. Photographier / Importer, 3. Partitions & MuseScore, 4. Guide (< 135 lignes).
 */
import React, { useState, useEffect } from 'react';
import { Printer, Camera, BookOpen, Compass, Music, X } from 'lucide-react';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { useVocalTransportStore } from '../../../stores/useVocalTransportStore';
import { useLanguage } from '../../../i18n/LanguageContext';
import { VocalPaperPrintTab, triggerVocalSheetPrint } from './VocalPaperPrintTab';
import { VocalPaperImportTab } from './VocalPaperImportTab';
import { VocalScoreAndMusicXmlTab } from './VocalScoreAndMusicXmlTab';

export type VocalPaperModalTabId = 'print' | 'import' | 'scores' | 'guide';

export interface VocalPaperWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ToadaProject;
  groupId?: string | null;
  isBr?: boolean;
  initialTab?: VocalPaperModalTabId;
  onProjectUpdate: (updated: ToadaProject) => void;
}

export const VocalPaperWorkshopModal: React.FC<VocalPaperWorkshopModalProps> = ({
  isOpen, onClose, project, groupId, isBr = false, initialTab = 'print', onProjectUpdate,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<VocalPaperModalTabId>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const tabClass = (id: VocalPaperModalTabId) =>
    `select-none px-3 py-1.5 rounded-t font-bold flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
      activeTab === id
        ? 'border-[#9a3412] dark:border-[#ea580c] bg-[#efe4cc] dark:bg-[#2a1f18] text-[#9a3412] dark:text-[#fdba74]'
        : 'border-transparent text-[#4a3b31] dark:text-[#cbbba0] hover:text-[#1c1613] dark:hover:text-[#f5ebd6]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg overflow-hidden shadow-2xl border-2 border-[#9a3412] dark:border-[#c2410c] bg-[#f4ecd8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#f5ebd6]">
        <div className="px-4 py-3 border-b-2 border-[var(--cordel-wood)] bg-[#efe6d0] dark:bg-[#211a15] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <Printer className="w-5 h-5 text-[#9a3412] dark:text-[#fdba74]" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-[#1c1613] dark:text-[#f5ebd6]">
                {isBr ? 'Oficina em Papel do Canto (A4 100 % P&B)' : 'Atelier Papier du Chant (A4 100 % N&B)'}
              </h2>
              <p className="text-[11px] text-[#4a3b31] dark:text-[#cbbba0]">
                {isBr
                  ? 'Grades A4 (5 folhas), Partituras 2 Pautas, MuseScore (.musicxml) e leitura óptica'
                  : 'Grilles A4 (5 feuilles), Partitions 2 Portées, MuseScore (.musicxml) & lecture optique'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 select-none">
            <button type="button" onClick={() => useVocalTransportStore.getState().setDictationModalOpen(true)} title={t('dialOpenDictationTitle')} className="px-2.5 py-1.5 rounded cordel-btn text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Compass className="w-3.5 h-3.5 text-[#9a3412] dark:text-[#fdba74]" />
              <span>{t('dialOpenDictationBtn')}</span>
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded cordel-btn cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="px-4 pt-2.5 border-b border-[#9a3412]/25 dark:border-[#4a392d] bg-[#efe6d0] dark:bg-[#211a15] flex flex-wrap gap-1.5 font-mono text-xs">
          <button type="button" onClick={() => setActiveTab('print')} className={tabClass('print')}>
            <Printer className="w-3.5 h-3.5" />
            <span>{isBr ? '1. Imprimir Folhas (5 modelos)' : '1. Imprimer Feuilles (5 modèles)'}</span>
          </button>
          <button type="button" onClick={() => setActiveTab('import')} className={tabClass('import')}>
            <Camera className="w-3.5 h-3.5" />
            <span>{isBr ? '2. Fotografar / Importar' : '2. Photographier / Importer'}</span>
          </button>
          <button type="button" onClick={() => setActiveTab('scores')} className={tabClass('scores')}>
            <Music className="w-3.5 h-3.5" />
            <span>{t('paperTabScoresMusicXml')}</span>
          </button>
          <button type="button" onClick={() => setActiveTab('guide')} className={tabClass('guide')}>
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('paperTabGuideConventions')}</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-[#f4ecd8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#f5ebd6]">
          {activeTab === 'print' && <VocalPaperPrintTab project={project} isBr={isBr} />}
          {activeTab === 'import' && (
            <VocalPaperImportTab
              project={project} groupId={groupId} isBr={isBr}
              onProjectImported={(updated) => { onProjectUpdate(updated); onClose(); }}
            />
          )}
          {activeTab === 'scores' && <VocalScoreAndMusicXmlTab project={project} />}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded border border-[#9a3412]/35 dark:border-[#4a392d] bg-[#efe4cc] dark:bg-[#241c16] text-[#1c1613] dark:text-[#f5ebd6] space-y-1.5">
                <div className="font-black uppercase text-[#9a3412] dark:text-[#fdba74]">1. Séparation stricte Patterns (P1..Pn) / Rôles (Pux & Cor)</div>
                <p className="text-[#3a2e26] dark:text-[#cbbba0]">Les feuilles de patterns sont neutres (<b>[Pattern : P1]</b>). C&apos;est sur la <b>Feuille 1 (Séquence)</b> que vous attribuez qui chante à chaque mesure sur les 2 lignes superposées : <b>Pux : P1 - P2 - X - X - P5</b> / <b>Cor : X - X - P3 - P4 - P5</b> (même code P5/P5 = Unisson ; P5/P6 = 2 voix ; X/X = [PAUSE 1M]).</p>
              </div>
              <div className="p-3 rounded border border-[#9a3412]/35 dark:border-[#4a392d] bg-[#efe4cc] dark:bg-[#241c16] text-[#1c1613] dark:text-[#f5ebd6] space-y-1.5">
                <div className="font-black uppercase text-[#9a3412] dark:text-[#fdba74]">2. Syllabes, Tirets &quot;-&quot;, Élisions &quot;E&apos;O&quot; &amp; Tablature 4 Étages (CHANT-TAB-4E)</div>
                <p className="text-[#3a2e26] dark:text-[#cbbba0]">Écrivez en <b>MAJUSCULES BÂTONS</b>. Sur la Feuille 5 (<b>CHANT-TAB-4E</b>), soudez les durées à cheval sur 2 temps avec <b>/</b> (ex: <b>4/4</b>), notez <b>0</b> pour un silence et <b>_</b> pour un mélisme.</p>
              </div>
              <div className="p-3 rounded border border-[#9a3412]/35 dark:border-[#4a392d] bg-[#efe4cc] dark:bg-[#241c16] text-[#1c1613] dark:text-[#f5ebd6] flex items-center justify-between gap-2">
                <div>
                  <div className="font-black uppercase text-[#9a3412] dark:text-[#fdba74]">3. Clavier 1 Octave (La ➔ Sol#) &amp; Ligne OCT / ±</div>
                  <p className="text-[#3a2e26] dark:text-[#cbbba0]">12 lignes de <b>La</b> à <b>Sol#</b> (filets renforcés sur La et Do, touches noires hachurées N&amp;B). Inscrivez <b>+1</b> ou <b>-1</b> dans <b>OCT / ±</b> en cas de saut d&apos;octave.</p>
                </div>
                <button type="button" onClick={() => triggerVocalSheetPrint({ sheetType: 'instructions' })} className="select-none px-3 py-1.5 rounded bg-[#9a3412] hover:bg-[#7c2d12] dark:bg-[#c2410c] dark:hover:bg-[#ea580c] text-white font-bold flex items-center gap-1.5 shrink-0 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /><span>{isBr ? 'Imprimir Guia A4' : 'Imprimer Guide A4'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
