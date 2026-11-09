/**
 * VocalPaperPrintTab.tsx
 * Onglet « Imprimer Feuilles Vierges (100 % N&B) » de l'Atelier Papier du Chant (< 130 lignes).
 * Permet d'imprimer les modèles A4 (Grille universelle Paysage 8 temps libres : 3 systèmes [P1]..[P3] sur Feuille 2, 6 systèmes sur Feuille 3).
 */
import React, { useState } from 'react';
import { Printer, FileText, Music, ListOrdered, BookOpen, Check } from 'lucide-react';
import type { VocalSheetType, VocalPaperPrintOptions } from '../../../types/vocalPaperWorkshop.types';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { wrapVocalSheetA4Document, printViaInvisibleIframe } from '../../../utils/vocal-paper/vocalPaperPrintHelper';
import { renderVocalSheetSequenceHTML } from '../../../utils/vocal-paper/vocalSheetSequenceTemplate';
import { renderVocalSheetNotesHTML } from '../../../utils/vocal-paper/vocalSheetNotesTemplate';
import { renderVocalSheetRhythmHTML } from '../../../utils/vocal-paper/vocalSheetRhythmTemplate';
import { renderVocalSheetInstructionsHTML } from '../../../utils/vocal-paper/vocalSheetInstructionsTemplate';
import { resolveProjectDualScale } from '../../../utils/scaleTranspositionHelper';

export interface VocalPaperPrintTabProps {
  project: ToadaProject;
  isBr?: boolean;
}

const SHEET_CARDS: Array<{ type: VocalSheetType; code: string; titleFr: string; titleBr: string; descFr: string; descBr: string; orientation: 'portrait' | 'landscape' }> = [
  {
    type: 'sequence', code: 'CHANT-SEQ', orientation: 'portrait',
    titleFr: 'Feuille 1 — Séquence & Paroles (Conducteur)', titleBr: 'Folha 1 — Sequência e Letra (Condutor)',
    descFr: 'Grille M1..M32 à 2 lignes superposées (Pux / Cor) pour placer P1..Pn, X (Pause) et Unisson + Paroles.',
    descBr: 'Grade M1..M32 com 2 linhas (Pux / Cor) para alocar P1..Pn, X (Pausa) e Uníssono + Letra.',
  },
  {
    type: 'notes_1m', code: 'CHANT-NOTES-1M', orientation: 'landscape',
    titleFr: 'Feuille 2 — Patterns & Piano Roll 1 Octave (Paysage • 3 Lignes)', titleBr: 'Folha 2 — Padrões e Piano Roll 1 Oitava (Paisagem • 3 Linhas)',
    descFr: '3 systèmes complets [P1]..[P3] par page A4 Paysage (~274mm utiles) : Piano Roll A (en bas) ➔ G# (en haut), TEMPS (5.5mm), OCT (5.5mm) & SYLLABES (11.5mm).',
    descBr: '3 sistemas completos [P1]..[P3] por página A4 Paisagem (~274mm úteis) : Piano Roll A (embaixo) ➔ G# (em cima), TEMPOS (5.5mm), OCT (5.5mm) e SÍLABAS (11.5mm).',
  },
  {
    type: 'rhythm_only', code: 'CHANT-RYTHME', orientation: 'landscape',
    titleFr: 'Feuille 3 — Paroles & Rythme Seul (Paysage • 8 Temps Libres)', titleBr: 'Folha 3 — Letra e Ritmo (Paisagem • 8 Tempos Livres)',
    descFr: '6 systèmes [ P__ ] par page A4 Paysage (32 subdivisions) : bande TEMPS libre, bande RYTHME (5.5mm) + bande SYLLABES ouverte (11mm).',
    descBr: '6 sistemas [ P__ ] por página A4 Paisagem (32 subdivisões) : faixa TEMPOS livres, faixa RITMO (5.5mm) + faixa SÍLABAS aberta (11mm).',
  },
  {
    type: 'instructions', code: 'CHANT-GUIDE', orientation: 'portrait',
    titleFr: "Feuille 4 — Guide & Conventions d'écriture manuscrite", titleBr: 'Folha 4 — Guia e Convenções de Escrita Manuscrita',
    descFr: 'Mémo illustré : Piano Roll A (bas) ➔ G# (haut), grille 8 temps libres (2|3|4|1|2|3|4|1 ou 2M), traits (───), SYLLABES ouverte et tirets "-".',
    descBr: 'Resumo ilustrado : Piano Roll A (baixo) ➔ G# (alto), grade 8 tempos livres (2|3|4|1|2|3|4|1 ou 2M), traços (───), SÍLABAS aberta e hífens "-".',
  },
];

export function triggerVocalSheetPrint(options: VocalPaperPrintOptions): void {
  let innerHtml = '', orientation: 'portrait' | 'landscape' = 'portrait';
  if (options.sheetType === 'sequence') innerHtml = renderVocalSheetSequenceHTML(options);
  else if (options.sheetType === 'notes_1m' || options.sheetType === 'notes_2m') {
    innerHtml = renderVocalSheetNotesHTML({ ...options, patternsCount: options.patternsCount ?? 3 });
    orientation = 'landscape';
  } else if (options.sheetType === 'rhythm_only') {
    innerHtml = renderVocalSheetRhythmHTML({ ...options, patternsCount: options.patternsCount ?? 6 });
    orientation = 'landscape';
  } else innerHtml = renderVocalSheetInstructionsHTML();
  printViaInvisibleIframe(wrapVocalSheetA4Document(innerHtml, orientation, `Atelier Papier — ${options.sheetType}`), `Atelier Papier — ${options.sheetType}`);
}

export const VocalPaperPrintTab: React.FC<VocalPaperPrintTabProps> = ({ project, isBr = false }) => {
  const dual = resolveProjectDualScale(project, isBr ? 'br' : 'fr');
  const [selectedSheet, setSelectedSheet] = useState<VocalSheetType>('sequence');
  const [prefillHeader, setPrefillHeader] = useState(true);
  const [startPatternNumber, setStartPatternNumber] = useState(1);

  const handlePrint = (sheetType: VocalSheetType) => triggerVocalSheetPrint({
    sheetType, title: prefillHeader ? project.title : '', bpm: prefillHeader ? project.bpm : undefined,
    timeSignature: project.timeSignature || '4/4', sungKey: prefillHeader ? dual.sungScaleLabel : '',
    troupeKey: prefillHeader ? dual.troupeScaleLabel : '', startPatternNumber,
  });

  return (
    <div className="space-y-3 text-xs font-mono">
      <div className="cordel-card-sm p-2.5 rounded flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={prefillHeader} onChange={(e) => setPrefillHeader(e.target.checked)} className="accent-[#9a3412]" />
          <span>{isBr ? `Pré-preencher cabeçalho (${project.title} • ${project.bpm} BPM)` : `Pré-remplir l'en-tête (${project.title} • ${project.bpm} BPM)`}</span>
        </label>
        <div className="inline-flex items-center gap-1.5">
          <span className="font-bold">{isBr ? 'Numeração inicial :' : 'Numérotation départ :'}</span>
          <select value={startPatternNumber} onChange={(e) => setStartPatternNumber(Number(e.target.value))} className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] rounded px-2 py-0.5 font-bold">
            {[1, 4, 7, 10, 13].map((n) => <option key={n} value={n}>P{n} ➔ P{n + 2}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {SHEET_CARDS.map((card) => {
          const active = selectedSheet === card.type;
          const Icon = card.type === 'sequence' ? ListOrdered : card.type === 'instructions' ? BookOpen : card.type === 'rhythm_only' ? FileText : Music;
          return (
            <div key={card.type} onClick={() => setSelectedSheet(card.type)} className={`p-3 rounded border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 ${active ? 'border-[#9a3412] bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] hover:border-amber-600/60'}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-theme-ink flex items-center gap-1.5"><Icon className="w-4 h-4 text-[#9a3412] dark:text-amber-300 shrink-0" /><span>{isBr ? card.titleBr : card.titleFr}</span></span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold border border-current rounded">[{card.code}]</span>
                </div>
                <p className="text-[11px] opacity-85 leading-snug">{isBr ? card.descBr : card.descFr}</p>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--cordel-border-sub)]">
                <span className="text-[10px] font-bold uppercase opacity-75">A4 {card.orientation === 'landscape' ? (isBr ? 'Paisagem' : 'Paysage') : (isBr ? 'Retrato' : 'Portrait')} • 100 % N&B</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handlePrint(card.type); }} className="px-2.5 py-1 rounded bg-[#9a3412] hover:bg-[#7c2d12] text-white font-bold flex items-center gap-1 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /><span>{isBr ? 'Imprimir A4' : 'Imprimer A4'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-2.5 rounded bg-amber-500/10 border border-amber-500/40">
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{isBr ? 'Zero cor / Zero cinza : hachuras P&B puras e 4 marcos ópticos ■ nos cantos.' : 'Zéro couleur / Zéro aplat gris : hachures N&B pures et 4 repères optiques ■ aux coins.'}</span>
        </div>
        <button type="button" onClick={() => handlePrint(selectedSheet)} className="px-3 py-1.5 rounded bg-[#9a3412] text-white font-bold flex items-center gap-1.5 cursor-pointer">
          <Printer className="w-4 h-4" /><span>{isBr ? 'Imprimir folha selecionada' : 'Imprimer la feuille sélectionnée'}</span>
        </button>
      </div>
    </div>
  );
};
