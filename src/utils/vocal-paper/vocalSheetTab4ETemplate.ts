/**
 * vocalSheetTab4ETemplate.ts
 * Feuille 5 : Tablature de Chant à 4 Étages ([CODE: CHANT-TAB-4E]) A4 Paysage 100 % N&B (< 120 lignes).
 * 4 repères d'angle ■, 5 systèmes par page (4.5 / 6.5 / 7.5 / 9.5 mm, gap 2.2 mm) et taquets 1.5 mm sur 2. SUBDIV.
 */
import type { VocalPaperPrintOptions } from '../../types/vocalPaperWorkshop.types';
import { renderFiducialCornersHTML, renderOpticalSheetCodeBadge } from './vocalPaperPrintHelper';
import { formatPaperNoteCode } from '../forcedMelodyAlignerFallback';

function esc(s?: string | number | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderVocalSheetTab4EHTML(options: VocalPaperPrintOptions): string {
  const blocksCount = options.patternsCount ?? 5;
  const startP = options.startPatternNumber ?? 1;
  const isBlankLabel = Boolean(options.blankPatternLabels || options.patternNumberingMode === 'blank');
  const titleText = options.title?.trim() ? esc(options.title.trim().toUpperCase()) : '________________';
  const prefills = options.prefillFromProject && Array.isArray(options.prefillPatterns) ? options.prefillPatterns : [];
  const colGroup = `<colgroup><col style="width:18mm;"/>${'<col/>'.repeat(8)}</colgroup>`;

  const renderSubdivTicks = (isLastBeat: boolean) => {
    const t123 = [1, 2, 3].map((n) =>
      `<span style="flex:1;height:1.5mm;border-right:0.8px solid #9a9a9a;font-size:4.1pt;font-weight:700;color:#666666;text-align:left;padding-left:0.4mm;line-height:1.5mm;">${n}</span>`
    ).join('');
    const t4Bdr = isLastBeat ? '' : 'border-right:1.1px solid #555555;';
    const t4 = `<span style="flex:1;height:1.8mm;${t4Bdr}font-size:4.1pt;font-weight:700;color:#666666;text-align:left;padding-left:0.4mm;line-height:1.5mm;">4</span>`;
    return `<div style="display:flex;width:100%;height:1.8mm;align-items:flex-start;">${t123}${t4}</div>`;
  };

  const renderBlock = (idx: number) => {
    const patNum = startP + idx;
    const pre = prefills[patNum - 1] || null;
    const patLabel = isBlankLabel && !pre?.code ? '[P__]' : `[ ${esc(pre?.code || `P${patNum}`)} ]`;
    const noteTokens = Array.isArray(pre?.referenceMidiNotes) && pre.referenceMidiNotes.length > 0
      ? pre.referenceMidiNotes.map((m) => formatPaperNoteCode(m))
      : [];
    const sylTokens = pre?.lyricsText ? pre.lyricsText.trim().split(/\s+/).filter(Boolean) : [];

    const tempsCells = Array.from({ length: 8 }, (_, b) =>
      `<th class="open-temps-cell" style="height:4.5mm;border-left:none;border-right:${b === 7 ? 'none' : '1.5px solid #000000'};font-size:7.8pt;font-weight:900;">${pre ? (b % 4) + 1 : ''}</th>`
    ).join('');

    const subdivCells = Array.from({ length: 8 }, (_, b) =>
      `<td class="subdiv-open-cell" style="height:6.5mm;vertical-align:top;padding:0;border-left:none;border-right:none;">${renderSubdivTicks(b === 7)}</td>`
    ).join('');

    const notesCells = Array.from({ length: 8 }, (_, b) =>
      `<td class="open-beat-cell" style="height:7.5mm;border-left:none;border-right:${b === 7 ? 'none' : '1.5px solid #000000'};font-size:8.4pt;font-weight:900;padding:0 2px;">${esc(noteTokens[b] || '')}</td>`
    ).join('');

    const sylCells = Array.from({ length: 8 }, (_, b) =>
      `<td class="open-beat-cell" style="height:9.5mm;border-left:none;border-right:${b === 7 ? 'none' : '1.5px solid #000000'};font-size:8.4pt;font-weight:900;padding:0 2px;">${esc(sylTokens[b] ? sylTokens[b].toUpperCase() : '')}</td>`
    ).join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000000;page-break-inside:avoid;break-inside:avoid;">
        <table>
          ${colGroup}
          <tbody>
            <tr style="border-bottom:1.5px solid #000000;">
              <th style="width:18mm;height:4.5mm;border-right:2px solid #000000;padding:0 1px;line-height:1;">
                <span style="font-size:7pt;font-weight:900;">${patLabel}</span>
                <span style="font-size:4.6pt;font-weight:800;display:block;">1. TEMPS</span>
              </th>
              ${tempsCells}
            </tr>
            <tr style="border-bottom:1.5px solid #000000;">
              <td style="width:18mm;height:6.5mm;font-size:4.8pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">2. SUBDIV.<br/>(ex: 4, 2+2, 4/4)</td>
              ${subdivCells}
            </tr>
            <tr style="border-bottom:1.5px solid #000000;">
              <td style="width:18mm;height:7.5mm;font-size:5pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">3. NOTES / 0<br/>(C, F#, A3, 0)</td>
              ${notesCells}
            </tr>
            <tr>
              <td style="width:18mm;height:9.5mm;font-size:5pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">4. SYLLABES<br/>(MAR- / _)</td>
              ${sylCells}
            </tr>
          </tbody>
        </table>
      </div>`;
  };

  const blocksHtml = Array.from({ length: blocksCount }, (_, i) => renderBlock(i)).join('');

  return `
    <div class="vocal-sheet-page vocal-print-page" style="padding:3mm 4.5mm;gap:1.8mm;">
      ${renderFiducialCornersHTML()}
      <div style="height:5.5mm;max-height:5.8mm;border-bottom:1.8px solid #000000;padding:0 3mm 0.6mm 3mm;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="min-width:0;flex:1;display:flex;align-items:baseline;gap:5px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:8.6pt;font-weight:900;text-transform:uppercase;flex-shrink:0;">FEUILLE 5 — TABLATURE 4 ÉTAGES (A4 PAYSAGE • 8 TEMPS)</span>
          <span style="font-size:5.7pt;font-weight:700;overflow:hidden;text-overflow:ellipsis;">• TITRE : ${titleText} • '/' = durée soudée (4/4) • '0' = silence • '_' = mélisme/tenue • '-' = mot coupé</span>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-TAB-4E')}
      </div>
      <div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2.2mm;">
        ${blocksHtml}
      </div>
    </div>`;
}
