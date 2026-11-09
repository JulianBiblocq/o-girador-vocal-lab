/**
 * vocalSheetNotesTemplate.ts
 * Feuille 2 : Patterns & Notes A4 Paysage Universel à 8 Temps Libres (32 subdivisions de ~8.4mm, 4 systèmes/page) (< 95 lignes).
 * Cartouche [ P__ ] (14mm), TEMPS vierge (4.5mm, colspan=4), OCTAVE (5.5mm, colspan=4), Clavier La..Sol# (12×2.2mm) et SYLLABES ouverte (9.5mm, colspan=4).
 */
import type { VocalPaperPrintOptions, KeyboardOctaveNote } from '../../types/vocalPaperWorkshop.types';
import { renderFiducialCornersHTML, renderOpticalSheetCodeBadge } from './vocalPaperPrintHelper';

export const VOCAL_PAPER_KEYBOARD_ROWS: Array<{ key: KeyboardOctaveNote; label: string; isBlack: boolean; strongBorder?: boolean }> = [
  { key: 'A', label: 'La (A)', isBlack: false, strongBorder: true },
  { key: 'Bb', label: 'Si♭', isBlack: true },
  { key: 'B', label: 'Si (B)', isBlack: false },
  { key: 'C', label: 'Do (C)', isBlack: false, strongBorder: true },
  { key: 'C#', label: 'Do#', isBlack: true },
  { key: 'D', label: 'Ré (D)', isBlack: false },
  { key: 'Eb', label: 'Mi♭', isBlack: true },
  { key: 'E', label: 'Mi (E)', isBlack: false },
  { key: 'F', label: 'Fa (F)', isBlack: false },
  { key: 'F#', label: 'Fa#', isBlack: true },
  { key: 'G', label: 'Sol (G)', isBlack: false },
  { key: 'G#', label: 'Sol#', isBlack: true },
];

export function renderVocalSheetNotesHTML(options: VocalPaperPrintOptions): string {
  const code = options.sheetType === 'notes_2m' ? 'CHANT-NOTES-2M' : 'CHANT-NOTES-1M';
  const blocksCount = options.patternsCount ?? 4;
  const startP = options.startPatternNumber ?? 1;
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '______________________';
  const rowH = '2.2mm';

  const blankTempsCells = Array.from({ length: 8 }, () =>
    `<th colspan="4" class="beat-sep-right open-temps-cell" style="height:4.5mm;border-right:1.5px solid #000;font-size:8pt;font-weight:900;"></th>`
  ).join('');

  const octBeatCells = Array.from({ length: 8 }, () =>
    `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:5.5mm;border-right:1.5px solid #000;font-size:7.5pt;font-weight:900;"></td>`
  ).join('');

  const openSylBeatCells = Array.from({ length: 8 }, () =>
    `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:9.5mm;border-right:1.5px solid #000;font-size:8.2pt;font-weight:900;"></td>`
  ).join('');

  const subGridCells = Array.from({ length: 32 }, (_, idx) => {
    const isBeatEnd = (idx + 1) % 4 === 0;
    const cls = isBeatEnd ? 'beat-sep-right' : 'sub-sep-right';
    const bdr = isBeatEnd ? 'border-right:1.5px solid #000;' : 'border-right:1px dotted #000;';
    return `<td class="${cls}" style="height:${rowH};${bdr}"></td>`;
  }).join('');

  const renderSinglePatternBlock = (idx: number) => {
    const patNum = startP + idx;
    const keyboardRowsHtml = VOCAL_PAPER_KEYBOARD_ROWS.map((k) => {
      const topBorder = k.strongBorder ? 'border-top:1.8px solid #000;' : '', keyCellClass = k.isBlack ? 'hatch-bw' : '';
      const labelSpan = k.isBlack
        ? `<span style="background:#fff;padding:0 1.5px;border:1px solid #000;font-size:5.5pt;font-weight:900;">${k.label}</span>`
        : `<span style="font-size:5.7pt;font-weight:900;">${k.label}</span>`;
      return `<tr style="${topBorder}"><td class="${keyCellClass}" style="width:14mm;height:${rowH};text-align:left;padding-left:2px;border-right:2px solid #000;line-height:1;">${labelSpan}</td>${subGridCells}</tr>`;
    }).join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000;page-break-inside:avoid;break-inside:avoid;">
        <table><tbody>
          <tr style="border-bottom:1.5px solid #000;">
            <th style="width:14mm;height:4.5mm;border-right:2px solid #000;padding:0 1px;line-height:1;">
              <span style="font-size:7pt;font-weight:900;">[ P${patNum} ]</span>
              <span style="font-size:4.8pt;font-weight:800;display:block;">TEMPS</span>
            </th>
            ${blankTempsCells}
          </tr>
          <tr style="border-bottom:1.8px solid #000;">
            <td style="width:14mm;height:5.5mm;font-size:5.4pt;font-weight:900;border-right:2px solid #000;line-height:1.05;">OCT / ±<br/>(3/4/5)</td>
            ${octBeatCells}
          </tr>
          ${keyboardRowsHtml}
          <tr style="border-top:2px solid #000;">
            <td style="width:14mm;height:9.5mm;font-size:5.6pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>
            ${openSylBeatCells}
          </tr>
        </tbody></table>
      </div>`;
  };

  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="height:6mm;max-height:6.5mm;border-bottom:2px solid #000;padding-bottom:0.8mm;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:baseline;gap:6px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:9pt;font-weight:900;text-transform:uppercase;">FEUILLE 2 — PATTERNS & NOTES (A4 PAYSAGE • 8 TEMPS LIBRES / 32 SUBDIVISIONS)</span>
          <span style="font-size:6.2pt;font-weight:700;">• TITRE : ${titleText} • Numéroter TEMPS (1..4) • Trait (───) = note • SYLLABES sous le trait</span>
        </div>
        ${renderOpticalSheetCodeBadge(code)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:2.5mm;">${Array.from({ length: blocksCount }, (_, i) => renderSinglePatternBlock(i)).join('')}</div>
    </div>`;
}
