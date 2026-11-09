/**
 * vocalPaperPrintHelper.ts
 * Moteur d'impression A4 Paysage 100 % Noir & Blanc sans pop-up (iframe invisible),
 * panier multi-feuilles (.vocal-print-page), repères optiques ■ et forçage monochrome (< 138 lignes).
 */
import type {
  VocalSheetOpticalCode, VocalPaperPrintOptions, VocalPaperCartQuantities, VocalPatternNumberingMode,
} from '../../types/vocalPaperWorkshop.types';
import { renderVocalSheetSequenceHTML } from './vocalSheetSequenceTemplate';
import { renderVocalSheetNotesHTML } from './vocalSheetNotesTemplate';
import { renderVocalSheetRhythmHTML } from './vocalSheetRhythmTemplate';
import { renderVocalSheetInstructionsHTML } from './vocalSheetInstructionsTemplate';

export function renderFiducialCornersHTML(): string {
  const base = 'position:absolute;width:5.5mm;height:5.5mm;background:#000000;color:#ffffff;font-size:6pt;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:20;';
  return `
    <div class="fiducial-tl" style="${base}top:1mm;left:1mm;">■</div>
    <div class="fiducial-tr" style="${base}top:1mm;right:1mm;">■</div>
    <div class="fiducial-bl" style="${base}bottom:1mm;left:1mm;">■</div>
    <div class="fiducial-br" style="${base}bottom:1mm;right:1mm;">■</div>
  `;
}

export function renderOpticalSheetCodeBadge(code: VocalSheetOpticalCode): string {
  return `<span class="optical-sheet-code" style="display:inline-block;border:2px solid #000000;padding:0.5px 5px;font-family:monospace;font-size:7.8pt;font-weight:900;letter-spacing:0.4px;background:#ffffff;color:#000000;">[CODE: ${code}]</span>`;
}

export function renderBwCheckbox(checked: boolean, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:8pt;font-weight:700;white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;border:1.5px solid #000000;background:${checked ? '#000000' : '#ffffff'};"></span><span>${label}</span></span>`;
}

export function wrapVocalSheetA4Document(
  innerPageHtml: string,
  _orientation?: string,
  title = 'Atelier Papier du Chant — O Girador'
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 7mm; }
    @media print {
      html, body {
        width: 283mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        filter: grayscale(100%) contrast(105%) !important;
        -webkit-filter: grayscale(100%) contrast(105%) !important;
        color-scheme: only light !important;
      }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: Arial, Helvetica, sans-serif;
      filter: grayscale(100%) contrast(105%); -webkit-filter: grayscale(100%) contrast(105%); color-scheme: only light;
    }
    .vocal-sheet-page, .vocal-print-page {
      position: relative; width: 283mm; max-width: 283mm; height: 196mm; max-height: 196mm;
      margin: 0 auto; padding: 3.5mm 4.5mm; border: 2px solid #000000; background: #ffffff; color: #000000;
      display: flex; flex-direction: column; justify-content: flex-start; gap: 2.5mm; overflow: hidden;
      page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page;
    }
    .vocal-print-page:last-child, .vocal-sheet-page:last-child { page-break-after: auto !important; break-after: auto !important; }
    .hatch-bw { background-image: repeating-linear-gradient(45deg, #000000 0, #000000 1px, #ffffff 1px, #ffffff 3.5px) !important; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #000000; padding: 0; line-height: 1; text-align: center; vertical-align: middle; color: #000000; }
    .sub-sep-right { border-right: 1px dotted #000000 !important; }
    .beat-sep-right { border-right: 1.5px solid #000000 !important; }
    .measure-sep-right { border-right: 2.5px double #000000 !important; }
    .strong-row-bottom { border-bottom: 1.8px solid #000000 !important; }
  </style>
</head>
<body>
  ${innerPageHtml}
</body>
</html>`;
}

export function buildVocalPaperBatchDocumentHTML(
  cart: Partial<VocalPaperCartQuantities>,
  options?: Partial<VocalPaperPrintOptions> & { patternNumberingMode?: VocalPatternNumberingMode }
): string {
  const clampQty = (v?: number) => Math.max(0, Math.min(20, Number(v ?? 0)));
  const seqCount = clampQty(cart.sequence), notesCount = clampQty(cart.notes), rhythmCount = clampQty(cart.rhythm), guideCount = clampQty(cart.instructions);
  const mode: VocalPatternNumberingMode = options?.patternNumberingMode || (options?.blankPatternLabels ? 'blank' : 'continuous');
  const pages: string[] = [];
  let nextPatNum = options?.startPatternNumber ?? 1;

  for (let i = 0; i < seqCount; i++) pages.push(renderVocalSheetSequenceHTML({ ...options, sheetType: 'sequence' }));
  for (let i = 0; i < notesCount; i++) {
    const startP = mode === 'continuous' ? nextPatNum : 1;
    pages.push(renderVocalSheetNotesHTML({ ...options, sheetType: 'notes_1m', patternsCount: 3, startPatternNumber: startP, patternNumberingMode: mode, blankPatternLabels: mode === 'blank' }));
    if (mode === 'continuous') nextPatNum += 3;
  }
  for (let i = 0; i < rhythmCount; i++) {
    const startP = mode === 'continuous' ? nextPatNum : 1;
    pages.push(renderVocalSheetRhythmHTML({ ...options, sheetType: 'rhythm_only', patternsCount: 6, startPatternNumber: startP, patternNumberingMode: mode, blankPatternLabels: mode === 'blank' }));
    if (mode === 'continuous') nextPatNum += 6;
  }
  for (let i = 0; i < guideCount; i++) pages.push(renderVocalSheetInstructionsHTML());

  return wrapVocalSheetA4Document(pages.join('\n'), 'landscape', `Lot Atelier Papier (${pages.length} feuilles A4)`);
}

export function printViaInvisibleIframe(htmlContent: string, _title = 'Atelier Papier du Chant'): void {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) { if (document.body.contains(iframe)) document.body.removeChild(iframe); return; }
  frameDoc.open(); frameDoc.write(htmlContent); frameDoc.close();
  setTimeout(() => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    finally { setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000); }
  }, 250);
}
