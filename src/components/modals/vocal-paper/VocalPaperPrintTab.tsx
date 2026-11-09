/**
 * VocalPaperPrintTab.tsx
 * Onglet « Panier d'Impression Multi-Feuilles (A4 Paysage 100 % N&B) » de l'Atelier Papier du Chant (< 142 lignes).
 * Permet de choisir la quantité (0..20) de chaque modèle, le mode de numérotation ([P__], continu, par feuille), d'afficher un aperçu et d'imprimer tout le lot.
 */
import React, { useState } from 'react';
import { Printer, Eye, X, Check } from 'lucide-react';
import type { VocalSheetType, VocalPaperPrintOptions, VocalPaperCartQuantities, VocalPatternNumberingMode } from '../../../types/vocalPaperWorkshop.types';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { wrapVocalSheetA4Document, buildVocalPaperBatchDocumentHTML, printViaInvisibleIframe } from '../../../utils/vocal-paper/vocalPaperPrintHelper';
import { renderVocalSheetSequenceHTML } from '../../../utils/vocal-paper/vocalSheetSequenceTemplate';
import { renderVocalSheetNotesHTML } from '../../../utils/vocal-paper/vocalSheetNotesTemplate';
import { renderVocalSheetRhythmHTML } from '../../../utils/vocal-paper/vocalSheetRhythmTemplate';
import { renderVocalSheetInstructionsHTML } from '../../../utils/vocal-paper/vocalSheetInstructionsTemplate';
import { resolveProjectDualScale } from '../../../utils/scaleTranspositionHelper';

export interface VocalPaperPrintTabProps {
  project: ToadaProject;
  isBr?: boolean;
}

const CART_ITEMS: Array<{
  key: keyof VocalPaperCartQuantities; sheetType: VocalSheetType; code: string;
  titleFr: string; titleBr: string; descFr: string; descBr: string;
}> = [
  { key: 'sequence', sheetType: 'sequence', code: 'CHANT-SEQ', titleFr: 'Feuille 1 — Séquence (Pux / Cor)', titleBr: 'Folha 1 — Sequência (Pux / Cor)', descFr: 'Grille large M1..M32 A4 Paysage (Pux / Cor) + Aide-mémoire P1..P10.', descBr: 'Grade larga M1..M32 A4 Paisagem (Pux / Cor) + Resumo P1..P10.' },
  { key: 'notes', sheetType: 'notes_1m', code: 'CHANT-NOTES-1M', titleFr: 'Feuille 2 — Patterns & Notes (Clavier + Syllabes)', titleBr: 'Folha 2 — Padrões e Notas (Teclado + Sílabas)', descFr: '3 systèmes A4 Paysage (8 temps libres) : Piano Roll A (bas) ➔ G# (haut), TEMPS, OCT & SYLLABES.', descBr: '3 sistemas A4 Paisagem (8 tempos livres) : Piano Roll A (baixo) ➔ G# (alto), TEMPOS, OCT e SÍLABAS.' },
  { key: 'rhythm', sheetType: 'rhythm_only', code: 'CHANT-RYTHME', titleFr: 'Feuille 3 — Paroles & Rythme seul', titleBr: 'Folha 3 — Letra e Ritmo', descFr: '6 systèmes A4 Paysage (32 subdivisions) : bande TEMPS libre, RYTHME (5.5mm) + SYLLABES ouverte.', descBr: '6 sistemas A4 Paisagem (32 subdivisões) : faixa TEMPOS livre, RITMO (5.5mm) + SÍLABAS aberta.' },
  { key: 'instructions', sheetType: 'instructions', code: 'CHANT-GUIDE', titleFr: 'Feuille 4 — Guide & Instructions', titleBr: 'Folha 4 — Guia e Instruções', descFr: 'Mémo illustré A4 Paysage : grille 8 temps libres, traits (───), tirets "-" et élisions.', descBr: 'Resumo ilustrado A4 Paisagem : grade 8 tempos livres, traços (───), hífens "-" e elisões.' },
];

export function renderSingleSheetPreviewHTML(options: VocalPaperPrintOptions): string {
  const isBlank = Boolean(options.blankPatternLabels || options.patternNumberingMode === 'blank');
  let inner = '';
  if (options.sheetType === 'sequence') inner = renderVocalSheetSequenceHTML(options);
  else if (options.sheetType === 'notes_1m' || options.sheetType === 'notes_2m') inner = renderVocalSheetNotesHTML({ ...options, patternsCount: 3, blankPatternLabels: isBlank });
  else if (options.sheetType === 'rhythm_only') inner = renderVocalSheetRhythmHTML({ ...options, patternsCount: 6, blankPatternLabels: isBlank });
  else inner = renderVocalSheetInstructionsHTML();
  return wrapVocalSheetA4Document(inner, 'landscape', `Aperçu — ${options.sheetType}`);
}

export function triggerVocalSheetPrint(options: VocalPaperPrintOptions): void {
  printViaInvisibleIframe(renderSingleSheetPreviewHTML(options), `Atelier Papier — ${options.sheetType}`);
}

export const VocalPaperPrintTab: React.FC<VocalPaperPrintTabProps> = ({ project, isBr = false }) => {
  const dual = resolveProjectDualScale(project, isBr ? 'br' : 'fr');
  const [cart, setCart] = useState<VocalPaperCartQuantities>({ sequence: 1, notes: 3, rhythm: 1, instructions: 0 });
  const [numberingMode, setNumberingMode] = useState<VocalPatternNumberingMode>('blank');
  const [prefillHeader, setPrefillHeader] = useState(true);
  const [previewSheet, setPreviewSheet] = useState<VocalSheetType | null>(null);

  const setQty = (key: keyof VocalPaperCartQuantities, val: number) => setCart((prev) => ({ ...prev, [key]: Math.max(0, Math.min(20, val)) }));
  const totalPages = cart.sequence + cart.notes + cart.rhythm + cart.instructions;
  const baseOpts = {
    title: prefillHeader ? project.title : '', bpm: prefillHeader ? project.bpm : undefined,
    timeSignature: project.timeSignature || '4/4', sungKey: prefillHeader ? dual.sungScaleLabel : '',
    troupeKey: prefillHeader ? dual.troupeScaleLabel : '', patternNumberingMode: numberingMode, blankPatternLabels: numberingMode === 'blank',
  };
  const handlePrintBatch = () => {
    if (totalPages > 0) printViaInvisibleIframe(buildVocalPaperBatchDocumentHTML(cart, baseOpts), `Lot Atelier Papier (${totalPages} feuilles A4 Paysage)`);
  };

  return (
    <div className="space-y-2.5 text-xs font-mono">
      <div className="cordel-card-sm p-2.5 rounded flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={prefillHeader} onChange={(e) => setPrefillHeader(e.target.checked)} className="accent-[#9a3412]" />
          <span>{isBr ? `Pré-preencher cabeçalho (${project.title} • ${project.bpm} BPM)` : `Pré-remplir l'en-tête (${project.title} • ${project.bpm} BPM)`}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['blank', isBr ? 'Deixar [ P__ ] vazio' : 'Laisser [ P__ ] vierge (numérotation libre à la main)'],
            ['continuous', isBr ? 'Numerar em contínuo (P1..Pn)' : 'Numéroter en continu sur tout le lot (P1, P2, P3... Pn)'],
            ['per_sheet', isBr ? 'Numerar P1..P3 por folha' : 'Numéroter P1..P3 par feuille'],
          ] as const).map(([mode, label]) => (
            <label key={mode} className="inline-flex items-center gap-1 font-bold cursor-pointer">
              <input type="radio" name="patNumMode" checked={numberingMode === mode} onChange={() => setNumberingMode(mode)} className="accent-[#9a3412]" />
              <span className="text-[11px]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {CART_ITEMS.map((item) => {
          const qty = cart[item.key];
          return (
            <div key={item.key} className={`p-2.5 rounded border-2 flex flex-wrap items-center justify-between gap-2 transition-all ${qty > 0 ? 'border-[#9a3412] bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] opacity-80'}`}>
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2 font-bold">
                  <span>{isBr ? item.titleBr : item.titleFr}</span>
                  <span className="px-1.5 py-0.2 text-[10px] border border-current rounded">[{item.code}]</span>
                </div>
                <p className="text-[10.5px] opacity-80 mt-0.5">{isBr ? item.descBr : item.descFr}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden bg-[var(--cordel-surface)]">
                  <button type="button" onClick={() => setQty(item.key, qty - 1)} className="px-2 py-1 font-black hover:bg-black/10 cursor-pointer">-</button>
                  <span className="w-8 text-center font-black">{qty}</span>
                  <button type="button" onClick={() => setQty(item.key, qty + 1)} className="px-2 py-1 font-black hover:bg-black/10 cursor-pointer">+</button>
                </div>
                <div className="inline-flex items-center gap-1">
                  {[0, 1, 3, 6].map((preset) => (
                    <button key={preset} type="button" onClick={() => setQty(item.key, preset)} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${qty === preset ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)]'}`}>{preset}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setPreviewSheet(previewSheet === item.sheetType ? null : item.sheetType)} className="px-2 py-1 rounded cordel-btn font-bold flex items-center gap-1 cursor-pointer">
                  <Eye className="w-3.5 h-3.5" /><span>{isBr ? 'Prévia' : 'Aperçu'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {previewSheet && (
        <div className="p-2 rounded border-2 border-[#9a3412] bg-white text-black space-y-1.5">
          <div className="flex items-center justify-between font-bold text-[11px]">
            <span>{isBr ? 'Pré-visualização A4 Paisagem (100 % P&B)' : 'Aperçu A4 Paysage (100 % Noir & Blanc)'} — {previewSheet}</span>
            <button type="button" onClick={() => setPreviewSheet(null)} className="px-1.5 py-0.5 rounded border border-black font-bold flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /><span>Fermer</span></button>
          </div>
          <iframe title="Aperçu feuille A4 Paysage" srcDoc={renderSingleSheetPreviewHTML({ ...baseOpts, sheetType: previewSheet })} className="w-full h-64 border border-black rounded bg-white" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/40">
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{isBr ? 'Abertura direta em A4 Paisagem • 100 % P&B monocromático.' : 'Ouverture directe en A4 Paysage • 100 % N&B monochrome strict.'}</span>
        </div>
        <button type="button" disabled={totalPages <= 0} onClick={handlePrintBatch} className="px-3.5 py-1.5 rounded bg-[#9a3412] hover:bg-[#7c2d12] disabled:opacity-40 text-white font-bold flex items-center gap-1.5 cursor-pointer">
          <Printer className="w-4 h-4" />
          <span>{isBr ? `Imprimir lote selecionado (${totalPages} folha(s) A4 Paisagem)` : `Imprimer le lot sélectionné (${totalPages} feuille${totalPages > 1 ? 's' : ''} A4 Paysage)`}</span>
        </button>
      </div>
    </div>
  );
};
