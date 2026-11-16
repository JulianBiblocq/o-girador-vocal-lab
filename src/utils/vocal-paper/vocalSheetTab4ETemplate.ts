/**
 * vocalSheetTab4ETemplate.ts
 * Feuille 5 : Tablature de Chant à 4 Étages ([CODE: CHANT-TAB-4E]) A4 Paysage 100 % N&B (< 115 lignes).
 * 4 repères d'angle ■, 4 systèmes par page : TEMPS / SUBDIVISIONS (soudure '/') / NOTES ou 0 / SYLLABES et _ + option de pré-remplissage.
 */
import type { VocalPaperPrintOptions } from '../../types/vocalPaperWorkshop.types';
import { renderFiducialCornersHTML, renderOpticalSheetCodeBadge } from './vocalPaperPrintHelper';
import { formatPaperNoteCode } from '../forcedMelodyAlignerFallback';

function esc(s?: string | number | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderVocalSheetTab4EHTML(options: VocalPaperPrintOptions): string {
  const blocksCount = options.patternsCount ?? 4;
  const startP = options.startPatternNumber ?? 1;
  const isBlankLabel = Boolean(options.blankPatternLabels || options.patternNumberingMode === 'blank');
  const titleText = options.title?.trim() ? esc(options.title.trim().toUpperCase()) : '______________________';
  const prefills = options.prefillFromProject && Array.isArray(options.prefillPatterns) ? options.prefillPatterns : [];

  const renderBlock = (idx: number) => {
    const patNum = startP + idx;
    const pre = prefills[patNum - 1] || null;
    const patLabel = isBlankLabel && !pre?.code ? '[P__]' : `[ ${esc(pre?.code || `P${patNum}`)} ]`;

    const noteTokens = Array.isArray(pre?.referenceMidiNotes) && pre.referenceMidiNotes.length > 0
      ? pre.referenceMidiNotes.map((m) => formatPaperNoteCode(m))
      : [];
    const sylTokens = pre?.lyricsText ? pre.lyricsText.trim().split(/\s+/).filter(Boolean) : [];

    const tempsCells = Array.from({ length: 8 }, (_, b) =>
      `<th colspan="4" class="beat-sep-right open-temps-cell" style="height:5mm;border-right:1.5px solid #000000;font-size:8pt;font-weight:900;">${pre ? (b % 4) + 1 : ''}</th>`
    ).join('');

    const subdivCells = Array.from({ length: 32 }, (_, s) => {
      const isBeatEnd = (s + 1) % 4 === 0;
      const bdr = isBeatEnd ? 'border-right:1.5px solid #000000;' : 'border-right:1px dotted #000000;';
      return `<td style="height:6.2mm;${bdr}vertical-align:top;text-align:left;padding:0.2mm 0.5mm;font-size:4.8pt;font-weight:700;">${(s % 4) + 1}</td>`;
    }).join('');

    const notesCells = Array.from({ length: 8 }, (_, b) =>
      `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:7.5mm;border-right:1.5px solid #000000;font-size:8.5pt;font-weight:900;padding:0 2px;">${esc(noteTokens[b] || '')}</td>`
    ).join('');

    const sylCells = Array.from({ length: 8 }, (_, b) =>
      `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:9.5mm;border-right:1.5px solid #000000;font-size:8.5pt;font-weight:900;padding:0 2px;">${esc(sylTokens[b] ? sylTokens[b].toUpperCase() : '')}</td>`
    ).join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000000;page-break-inside:avoid;break-inside:avoid;">
        <table>
          <tbody>
            <tr style="border-bottom:1.5px solid #000000;">
              <th style="width:18mm;height:5mm;border-right:2px solid #000000;padding:0 1px;line-height:1;">
                <span style="font-size:7.2pt;font-weight:900;">${patLabel}</span>
                <span style="font-size:4.8pt;font-weight:800;display:block;">1. TEMPS</span>
              </th>
              ${tempsCells}
            </tr>
            <tr style="border-bottom:1.5px solid #000000;">
              <td style="width:18mm;height:6.2mm;font-size:5.1pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">2. SUBDIV.<br/>(ex: 4/4)</td>
              ${subdivCells}
            </tr>
            <tr style="border-bottom:1.5px solid #000000;">
              <td style="width:18mm;height:7.5mm;font-size:5.2pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">3. NOTES / 0<br/>(C, F#, A3, 0)</td>
              ${notesCells}
            </tr>
            <tr>
              <td style="width:18mm;height:9.5mm;font-size:5.2pt;font-weight:900;border-right:2px solid #000000;line-height:1.05;">4. SYLLABES<br/>(MAR- / _)</td>
              ${sylCells}
            </tr>
          </tbody>
        </table>
      </div>`;
  };

  const blocksHtml = Array.from({ length: blocksCount }, (_, i) => renderBlock(i)).join('');

  return `
    <div class="vocal-sheet-page vocal-print-page">
      ${renderFiducialCornersHTML()}
      <div style="height:6mm;max-height:6.5mm;border-bottom:2px solid #000000;padding-bottom:0.8mm;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:baseline;gap:6px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:9.2pt;font-weight:900;text-transform:uppercase;">FEUILLE 5 — TABLATURE 4 ÉTAGES (A4 PAYSAGE • 8 TEMPS / SOUDURE '/')</span>
          <span style="font-size:6.2pt;font-weight:700;">• TITRE : ${titleText} • '/' = durée soudée (4/4) • '0' = silence • '_' = mélisme/tenue • '-' = coupe syllabe</span>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-TAB-4E')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:2.8mm;">
        ${blocksHtml}
      </div>
    </div>`;
}
