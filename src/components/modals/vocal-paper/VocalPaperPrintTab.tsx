/**
 * VocalPaperPrintTab.tsx
 * Onglet « Panier d'Impression Multi-Feuilles (5 modèles A4 Paysage 100 % N&B) » de l'Atelier Papier du Chant (< 142 lignes).
 * Contraste Jour / Nuit Cordel strict sur les cartes sélectionnées (qty > 0), les cartes à 0 et le bandeau récapitulatif.
 */
import React, { useState, useMemo } from 'react';
import { Printer, Eye, X, Check } from 'lucide-react';
import type { VocalSheetType, VocalPaperPrintOptions, VocalPaperCartQuantities, VocalPatternNumberingMode } from '../../../types/vocalPaperWorkshop.types';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { wrapVocalSheetA4Document, buildVocalPaperBatchDocumentHTML, printViaInvisibleIframe } from '../../../utils/vocal-paper/vocalPaperPrintHelper';
import { renderVocalSheetSequenceHTML } from '../../../utils/vocal-paper/vocalSheetSequenceTemplate';
import { renderVocalSheetNotesHTML } from '../../../utils/vocal-paper/vocalSheetNotesTemplate';
import { renderVocalSheetRhythmHTML } from '../../../utils/vocal-paper/vocalSheetRhythmTemplate';
import { renderVocalSheetInstructionsHTML } from '../../../utils/vocal-paper/vocalSheetInstructionsTemplate';
import { renderVocalSheetTab4EHTML } from '../../../utils/vocal-paper/vocalSheetTab4ETemplate';
import { resolveProjectDualScale } from '../../../utils/scaleTranspositionHelper';

export interface VocalPaperPrintTabProps { project: ToadaProject; isBr?: boolean; }

export const VOCAL_PAPER_CART_ITEMS: Array<{
  key: keyof VocalPaperCartQuantities; sheetType: VocalSheetType; code: string;
  titleFr: string; titleBr: string; descFr: string; descBr: string;
}> = [
  { key: 'sequence', sheetType: 'sequence', code: 'CHANT-SEQ', titleFr: 'Feuille 1 — Séquence (Pux / Cor)', titleBr: 'Folha 1 — Sequência (Pux / Cor)', descFr: 'Grille large M1..M32 A4 Paysage (Pux / Cor) + Aide-mémoire P1..P10.', descBr: 'Grade larga M1..M32 A4 Paisagem (Pux / Cor) + Resumo P1..P10.' },
  { key: 'notes', sheetType: 'notes_1m', code: 'CHANT-NOTES-1M', titleFr: 'Feuille 2 — Patterns & Notes (Clavier + Syllabes)', titleBr: 'Folha 2 — Padrões e Notas (Teclado + Sílabas)', descFr: '3 systèmes A4 Paysage (8 temps libres) : Piano Roll A (bas) ➔ G# (haut), TEMPS, OCT & SYLLABES.', descBr: '3 sistemas A4 Paisagem (8 tempos livres) : Piano Roll A (baixo) ➔ G# (alto), TEMPOS, OCT e SÍLABAS.' },
  { key: 'rhythm', sheetType: 'rhythm_only', code: 'CHANT-RYTHME', titleFr: 'Feuille 3 — Paroles & Rythme seul', titleBr: 'Folha 3 — Letra e Ritmo', descFr: '6 systèmes A4 Paysage (32 subdivisions) : bande TEMPS libre, RYTHME (5.5mm) + SYLLABES ouverte.', descBr: '6 sistemas A4 Paisagem (32 subdivisões) : faixa TEMPOS livre, RITMO (5.5mm) + SÍLABAS aberta.' },
  { key: 'instructions', sheetType: 'instructions', code: 'CHANT-GUIDE', titleFr: 'Feuille 4 — Guide & Instructions', titleBr: 'Folha 4 — Guia e Instruções', descFr: 'Mémo illustré A4 Paysage : grille 8 temps libres, traits (───), tirets "-" et élisions.', descBr: 'Resumo ilustrado A4 Paisagem : grade 8 tempos livres, traços (───), hífens "-" e elisões.' },
  { key: 'tab4e', sheetType: 'tab_4e', code: 'CHANT-TAB-4E', titleFr: 'Feuille 5 — Tablature 4 Étages', titleBr: 'Folha 5 — Tablatura 4 Níveis', descFr: '5 systèmes A4 Paysage (4 bandes : TEMPS / SUBDIV. 4, 2+2, 4/4 / NOTES ou 0 / SYLLABES et _).', descBr: '5 sistemas A4 Paisagem (4 faixas : TEMPOS / SUBDIV. 4, 2+2, 4/4 / NOTAS ou 0 / SÍLABAS e _).' },
];

export function renderSingleSheetPreviewHTML(options: VocalPaperPrintOptions): string {
  const isBlank = Boolean(options.blankPatternLabels || options.patternNumberingMode === 'blank');
  const inner = options.sheetType === 'sequence' ? renderVocalSheetSequenceHTML(options)
    : options.sheetType === 'notes_1m' || options.sheetType === 'notes_2m' ? renderVocalSheetNotesHTML({ ...options, patternsCount: 3, blankPatternLabels: isBlank })
    : options.sheetType === 'rhythm_only' ? renderVocalSheetRhythmHTML({ ...options, patternsCount: 6, blankPatternLabels: isBlank })
    : options.sheetType === 'tab_4e' ? renderVocalSheetTab4EHTML({ ...options, patternsCount: 5, blankPatternLabels: isBlank })
    : renderVocalSheetInstructionsHTML();
  return wrapVocalSheetA4Document(inner, 'landscape', `Aperçu — ${options.sheetType}`);
}

export function triggerVocalSheetPrint(options: VocalPaperPrintOptions): void {
  printViaInvisibleIframe(renderSingleSheetPreviewHTML(options), `Atelier Papier — ${options.sheetType}`);
}

export const VocalPaperPrintTab: React.FC<VocalPaperPrintTabProps> = ({ project, isBr = false }) => {
  const dual = resolveProjectDualScale(project, isBr ? 'br' : 'fr');
  const [cart, setCart] = useState<VocalPaperCartQuantities>({ sequence: 1, notes: 3, rhythm: 1, instructions: 0, tab4e: 0 });
  const [numberingMode, setNumberingMode] = useState<VocalPatternNumberingMode>('blank');
  const [prefillHeader, setPrefillHeader] = useState(true), [prefillTab4E, setPrefillTab4E] = useState(false);
  const [previewSheet, setPreviewSheet] = useState<VocalSheetType | null>(null);
  const prefillPatterns = useMemo(() => (project.patterns || []).map((p, idx) => ({ code: `P${idx + 1}`, lyricsText: p.assignedLyricsText || '', referenceMidiNotes: p.referenceMidiNotes || [] })), [project.patterns]);
  const setQty = (key: keyof VocalPaperCartQuantities, val: number) => setCart((prev) => ({ ...prev, [key]: Math.max(0, Math.min(20, val)) }));
  const totalPages = cart.sequence + cart.notes + cart.rhythm + cart.instructions + (cart.tab4e ?? 0);
  const baseOpts: Partial<VocalPaperPrintOptions> = {
    title: prefillHeader ? project.title : '', bpm: prefillHeader ? project.bpm : undefined, timeSignature: project.timeSignature || '4/4',
    sungKey: prefillHeader ? dual.sungScaleLabel : '', troupeKey: prefillHeader ? dual.troupeScaleLabel : '',
    patternNumberingMode: numberingMode, blankPatternLabels: numberingMode === 'blank', prefillFromProject: prefillTab4E, prefillPatterns,
  };
  const handlePrintBatch = () => { if (totalPages > 0) printViaInvisibleIframe(buildVocalPaperBatchDocumentHTML(cart, baseOpts), `Lot Atelier Papier (${totalPages} feuilles A4 Paysage)`); };

  return (
    <div className="space-y-2.5 text-xs font-mono">
      <div className="p-2.5 rounded border border-[#9a3412]/30 dark:border-[#4a392d] bg-[#efe6d0] dark:bg-[#211a15] text-[#1c1613] dark:text-[#f5ebd6] flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={prefillHeader} onChange={(e) => setPrefillHeader(e.target.checked)} className="accent-[#9a3412]" /><span>{isBr ? `Pré-preencher cabeçalho (${project.title})` : `Pré-remplir l'en-tête (${project.title})`}</span></label>
          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={prefillTab4E} onChange={(e) => setPrefillTab4E(e.target.checked)} className="accent-[#9a3412]" /><span>{isBr ? 'Pré-preencher letra/notas na Folha 5' : 'Pré-remplir paroles / notes réf. sur Feuille 5'}</span></label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([['blank', isBr ? '[ P__ ] vazio' : '[ P__ ] vierge'], ['continuous', isBr ? 'Contínuo (P1..Pn)' : 'Continu (P1..Pn)'], ['per_sheet', isBr ? 'Por folha' : 'Par feuille']] as const).map(([mode, label]) => (
            <label key={mode} className="inline-flex items-center gap-1 font-bold cursor-pointer"><input type="radio" name="patNumMode" checked={numberingMode === mode} onChange={() => setNumberingMode(mode)} className="accent-[#9a3412]" /><span className="text-[11px]">{label}</span></label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {VOCAL_PAPER_CART_ITEMS.map((item) => {
          const qty = cart[item.key] ?? 0, active = qty > 0;
          const cardCls = active ? 'bg-[#efe4cc] border-[#9a3412] text-[#1c1613] dark:bg-[#2a1f18] dark:border-[#c2410c] dark:text-[#f5ebd6]' : 'bg-[#f8f2e4] border-[#cbbba0] text-[#3a2e26] dark:bg-[#1b1511] dark:border-[#3d2f25] dark:text-[#d6c8b2]';
          const badgeCls = active ? 'bg-[#faf5e8] text-[#1c1613] border-[#9a3412]/55 dark:bg-[#16120e] dark:text-[#f5ebd6] dark:border-[#c2410c]/70' : 'bg-[#efe6d0] text-[#4a3b31] border-[#b5a48b] dark:bg-[#14100d] dark:text-[#cbbba0] dark:border-[#4a392d]';
          return (
            <div key={item.key} className={`p-2.5 rounded border-2 flex flex-wrap items-center justify-between gap-2 transition-colors ${cardCls}`}>
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2 font-bold"><span>{isBr ? item.titleBr : item.titleFr}</span><span className={`px-1.5 py-0.2 text-[10px] border rounded font-bold ${badgeCls}`}>[{item.code}]</span></div>
                <p className={`text-[10.5px] mt-0.5 ${active ? 'text-[#4a3b31] dark:text-[#cbbba0]' : 'text-[#5c4b3e] dark:text-[#9c8c76]'}`}>{isBr ? item.descBr : item.descFr}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 select-none">
                <div className="inline-flex items-center border border-[#9a3412]/40 dark:border-[#5c4333] rounded overflow-hidden bg-[#faf5e8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#f5ebd6]">
                  <button type="button" onClick={() => setQty(item.key, qty - 1)} className="select-none px-2 py-1 font-black hover:bg-[#e5d5b5] dark:hover:bg-[#36281f] cursor-pointer">-</button>
                  <span className="select-none w-8 text-center font-black">{qty}</span>
                  <button type="button" onClick={() => setQty(item.key, qty + 1)} className="select-none px-2 py-1 font-black hover:bg-[#e5d5b5] dark:hover:bg-[#36281f] cursor-pointer">+</button>
                </div>
                <div className="inline-flex items-center gap-1">
                  {[0, 1, 3, 6].map((preset) => (
                    <button key={preset} type="button" onClick={() => setQty(item.key, preset)} className={`select-none px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${qty === preset ? 'bg-[#9a3412] dark:bg-[#c2410c] text-white border-[#9a3412] dark:border-[#c2410c]' : 'border-[#bfa98a] dark:border-[#4a392d] bg-[#faf5e8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#cbbba0] hover:bg-[#e5d5b5] dark:hover:bg-[#2a1f18]'}`}>{preset}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setPreviewSheet(previewSheet === item.sheetType ? null : item.sheetType)} className="select-none px-2 py-1 rounded border border-[#9a3412]/45 dark:border-[#5c4333] bg-[#faf5e8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#f5ebd6] hover:bg-[#9a3412] hover:text-white dark:hover:bg-[#c2410c] font-bold flex items-center gap-1 cursor-pointer transition-colors">
                  <Eye className="w-3.5 h-3.5" /><span>{isBr ? 'Prévia' : 'Aperçu'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {previewSheet && (
        <div className="p-2 rounded border-2 border-[#9a3412] bg-white text-black space-y-1.5 select-none">
          <div className="flex items-center justify-between font-bold text-[11px] bg-white text-black">
            <span>{isBr ? 'Pré-visualização A4 Paisagem (100 % P&B)' : 'Aperçu A4 Paysage (100 % Noir & Blanc)'} — {previewSheet}</span>
            <button type="button" onClick={() => setPreviewSheet(null)} className="px-2 py-0.5 rounded border border-black bg-stone-100 hover:bg-stone-200 text-black font-bold flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /><span>{isBr ? 'Fechar' : 'Fermer'}</span></button>
          </div>
          <iframe title="Aperçu feuille A4 Paysage" srcDoc={renderSingleSheetPreviewHTML({ ...baseOpts, sheetType: previewSheet })} className="w-full h-64 border border-black rounded bg-white text-black" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-[#efe4cc] text-[#1c1613] border border-[#9a3412]/40 dark:bg-[#241c16] dark:text-[#f5ebd6] dark:border-[#c2410c]/50">
        <div className="flex items-center gap-2 text-[11px] font-bold"><Check className="w-4 h-4 text-emerald-800 dark:text-emerald-400 shrink-0" /><span>{isBr ? 'Abertura direta em A4 Paisagem • 100 % P&B monocromático.' : 'Ouverture directe en A4 Paysage • 100 % N&B monochrome strict.'}</span></div>
        <button type="button" disabled={totalPages <= 0} onClick={handlePrintBatch} className="select-none px-3.5 py-1.5 rounded bg-[#9a3412] hover:bg-[#7c2d12] dark:bg-[#c2410c] dark:hover:bg-[#ea580c] disabled:opacity-40 text-white font-bold flex items-center gap-1.5 cursor-pointer">
          <Printer className="w-4 h-4" /><span>{isBr ? `Imprimir lote selecionado (${totalPages} folha(s) A4 Paisagem)` : `Imprimer le lot sélectionné (${totalPages} feuille${totalPages > 1 ? 's' : ''} A4 Paysage)`}</span>
        </button>
      </div>
    </div>
  );
};
