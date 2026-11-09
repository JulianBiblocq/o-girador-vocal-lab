/**
 * vocalSheetRhythmTemplate.ts
 * Feuille 3 : Paroles & Rythme Seul A4 Paysage Universel à 8 Temps Libres (32 subdivisions de ~8.4mm, 6 systèmes/page) (< 90 lignes).
 * Cartouche vertical gauche [ P__ ] (14mm), TEMPS vierge (4.5mm, colspan=4), RYTHME (5.5mm, 32 sous-cases) et SYLLABES ouverte (11mm, colspan=4).
 */
import type { VocalPaperPrintOptions } from '../../types/vocalPaperWorkshop.types';
import {
  renderFiducialCornersHTML,
  renderOpticalSheetCodeBadge,
} from './vocalPaperPrintHelper';

export function renderVocalSheetRhythmHTML(options: VocalPaperPrintOptions): string {
  const blocksCount = options.patternsCount ?? 6;
  const startP = options.startPatternNumber ?? 1;
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '______________________';

  const blankTempsCells = Array.from({ length: 8 }, () =>
    `<th colspan="4" class="beat-sep-right open-temps-cell" style="height:4.5mm;border-right:1.5px solid #000;font-size:8pt;font-weight:900;"></th>`
  ).join('');

  const rhythmCells = Array.from({ length: 8 }, () =>
    [1, 2, 3, 4]
      .map((s) => {
        const isBeatEnd = s === 4;
        const cls = isBeatEnd ? 'beat-sep-right' : 'sub-sep-right';
        const bdr = isBeatEnd ? 'border-right:1.5px solid #000;' : 'border-right:1px dotted #000;';
        return `<td class="${cls}" style="height:5.5mm;${bdr}vertical-align:top;text-align:left;padding:0.2mm 0.5mm;font-size:4.8pt;font-weight:700;line-height:1;">${s}</td>`;
      })
      .join('')
  ).join('');

  const openSylBands = Array.from({ length: 8 }, () =>
    `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:11mm;border-right:1.5px solid #000;font-size:8.5pt;font-weight:900;"></td>`
  ).join('');

  const renderBlock = (idx: number) => {
    const patNum = startP + idx;
    return `
      <div class="vocal-pattern-block" style="border:2px solid #000;page-break-inside:avoid;break-inside:avoid;">
        <table>
          <tbody>
            <tr style="border-bottom:1.5px solid #000;">
              <th style="width:14mm;height:4.5mm;border-right:2px solid #000;padding:0 1px;line-height:1;">
                <span style="font-size:7.2pt;font-weight:900;">[ P${patNum} ]</span>
                <span style="font-size:4.8pt;font-weight:800;display:block;">TEMPS</span>
              </th>
              ${blankTempsCells}
            </tr>
            <tr style="border-bottom:2px solid #000;">
              <td style="width:14mm;height:5.5mm;font-size:5.3pt;font-weight:900;border-right:2px solid #000;line-height:1.05;">RYTHME<br/>(───)</td>
              ${rhythmCells}
            </tr>
            <tr>
              <td style="width:14mm;height:11mm;font-size:5.6pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>
              ${openSylBands}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const blocksHtml = Array.from({ length: blocksCount }, (_, i) => renderBlock(i)).join('');

  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="height:6mm;max-height:6.5mm;border-bottom:2px solid #000;padding-bottom:0.8mm;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:baseline;gap:6px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:9.2pt;font-weight:900;text-transform:uppercase;">FEUILLE 3 — PAROLES & RYTHME (A4 PAYSAGE • 8 TEMPS LIBRES / 32 SUBDIVISIONS)</span>
          <span style="font-size:6.3pt;font-weight:700;">• TITRE : ${titleText} • TEMPS (1..4) • Trait RYTHME (───) • SYLLABES ouverte • "-" = même mot</span>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-RYTHME')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:2.5mm;">
        ${blocksHtml}
      </div>
    </div>
  `;
}
