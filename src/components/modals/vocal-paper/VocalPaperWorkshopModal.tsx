/**
 * VocalPaperWorkshopModal.tsx
 * Modale principale « Atelier Papier du Chant » (Cantador) à 3 onglets :
 * 1. Imprimer Feuilles Vierges (100 % N&B), 2. Photographier / Importer mes Feuilles (Multi-pages), 3. Guide & Conventions (< 120 lignes).
 */
import React, { useState } from 'react';
import { Printer, Camera, BookOpen, X } from 'lucide-react';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { VocalPaperPrintTab, triggerVocalSheetPrint } from './VocalPaperPrintTab';
import { VocalPaperImportTab } from './VocalPaperImportTab';

export interface VocalPaperWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ToadaProject;
  groupId?: string | null;
  isBr?: boolean;
  onProjectUpdate: (updated: ToadaProject) => void;
}

export const VocalPaperWorkshopModal: React.FC<VocalPaperWorkshopModalProps> = ({
  isOpen, onClose, project, groupId, isBr = false, onProjectUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'print' | 'import' | 'guide'>('print');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3">
      <div className="cordel-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg overflow-hidden shadow-2xl border-2 border-[var(--cordel-wood)]">
        <div className="px-4 py-3 border-b-2 border-[var(--cordel-wood)] bg-[var(--cordel-surface)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono">
            <Printer className="w-5 h-5 text-[#9a3412] dark:text-amber-300" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-theme-ink">
                {isBr ? 'Oficina em Papel do Canto (A4 100 % P&B)' : 'Atelier Papier du Chant (A4 100 % N&B)'}
              </h2>
              <p className="text-[11px] opacity-80">
                {isBr
                  ? 'Impressão A4 monocromática e leitura óptica multi-páginas (Sequência + Padrões P1..Pn)'
                  : 'Impression A4 monochrome & lecture optique multi-pages (Séquence + Patterns neutres P1..Pn)'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded cordel-btn cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 pt-2.5 border-b border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] flex flex-wrap gap-1.5 font-mono text-xs">
          <button
            type="button" onClick={() => setActiveTab('print')}
            className={`px-3 py-1.5 rounded-t font-bold flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'print' ? 'border-[#9a3412] bg-amber-500/15 text-[#9a3412] dark:text-amber-300' : 'border-transparent opacity-75 hover:opacity-100'}`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isBr ? '1. Imprimir Folhas em Branco (100 % P&B)' : '1. Imprimer Feuilles Vierges (100 % N&B)'}</span>
          </button>
          <button
            type="button" onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-t font-bold flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'import' ? 'border-[#9a3412] bg-amber-500/15 text-[#9a3412] dark:text-amber-300' : 'border-transparent opacity-75 hover:opacity-100'}`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isBr ? '2. Fotografar / Importar Folhas (Multi-páginas)' : '2. Photographier / Importer mes Feuilles (Multi-pages)'}</span>
          </button>
          <button
            type="button" onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-t font-bold flex items-center gap-1.5 cursor-pointer border-b-2 ${activeTab === 'guide' ? 'border-[#9a3412] bg-amber-500/15 text-[#9a3412] dark:text-amber-300' : 'border-transparent opacity-75 hover:opacity-100'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isBr ? '3. Guia e Convenções de Escrita' : "3. Guide & Conventions d'écriture"}</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-[var(--cordel-paper)]">
          {activeTab === 'print' && <VocalPaperPrintTab project={project} isBr={isBr} />}
          {activeTab === 'import' && (
            <VocalPaperImportTab
              project={project} groupId={groupId} isBr={isBr}
              onProjectImported={(updated) => { onProjectUpdate(updated); onClose(); }}
            />
          )}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs font-mono">
              <div className="cordel-card-sm p-3 rounded space-y-1.5">
                <div className="font-black uppercase text-[#9a3412] dark:text-amber-300">1. Séparation stricte Patterns (P1..Pn) / Rôles (Pux & Cor)</div>
                <p>Les feuilles de patterns sont neutres (<b>[Pattern : P1]</b>). C&apos;est sur la <b>Feuille 1 (Séquence)</b> que vous attribuez qui chante à chaque mesure sur les 2 lignes superposées : <b>Pux : P1 - P2 - X - X - P5</b> / <b>Cor : X - X - P3 - P4 - P5</b> (même code P5/P5 = Unisson ; P5/P6 = 2 voix ; X/X = [PAUSE 1M]).</p>
              </div>
              <div className="cordel-card-sm p-3 rounded space-y-1.5">
                <div className="font-black uppercase text-[#9a3412] dark:text-amber-300">2. Syllabes, Tirets &quot;-&quot;, Élisions &quot;E&apos;O&quot; &amp; Tenues &quot;───►&quot;</div>
                <p>Écrivez en <b>MAJUSCULES BÂTONS</b>. Ajoutez un tiret <b>-</b> en fin de case pour souder deux syllabes d&apos;un même mot (ex: <b>VO-</b> | <b>VÓ</b> | <b>FA-</b> | <b>LOU</b>). Unissez les élisions par une apostrophe dans la même case (<b>E&apos;O</b>). Tracez <b>───►</b> pour prolonger une tenue.</p>
              </div>
              <div className="cordel-card-sm p-3 rounded flex items-center justify-between gap-2">
                <div>
                  <div className="font-black uppercase text-[#9a3412] dark:text-amber-300">3. Clavier 1 Octave (La ➔ Sol#) &amp; Ligne OCT / ±</div>
                  <p>12 lignes de <b>La</b> à <b>Sol#</b> (filets renforcés sur La et Do, touches noires hachurées N&amp;B). Inscrivez <b>+1</b> ou <b>-1</b> dans <b>OCT / ±</b> en cas de saut d&apos;octave.</p>
                </div>
                <button type="button" onClick={() => triggerVocalSheetPrint({ sheetType: 'instructions' })} className="px-3 py-1.5 rounded bg-[#9a3412] text-white font-bold flex items-center gap-1.5 shrink-0 cursor-pointer">
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
