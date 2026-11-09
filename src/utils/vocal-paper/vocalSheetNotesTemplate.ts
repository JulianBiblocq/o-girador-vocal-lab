/**
 * vocalSheetNotesTemplate.ts
 * Feuille 2 : Patterns & Notes A4 Paysage (3 systèmes [P1]..[P3] ou [P__] / page, 8 Temps Libres / 32 subdivisions de ~8.5mm) (< 105 lignes).
 * Clavier Piano Roll de bas en haut (A en bas ➔ G# en haut, donc dans le DOM de haut en bas : G# ➔ A, 12×1.8mm = 21.6mm),
 * colonne gauche 8.5mm avec lettres A..G seules, TEMPS (5.5mm), OCT (5.5mm) et SYLLABES ouverte (11.5mm).
 */
import type { VocalPaperPrintOptions, KeyboardOctaveNote } from '../../types/vocalPaperWorkshop.types';
import { renderFiducialCornersHTML, renderOpticalSheetCodeBadge } from './vocalPaperPrintHelper';

export const VOCAL_PAPER_KEYBOARD_ROWS: Array<{ key: KeyboardOctaveNote; label: string; isBlack: boolean; strongBorder?: boolean }> = [
  { key: 'G#', label: 'G#', isBlack: true },
  { key: 'G', label: 'G', isBlack: false },
  { key: 'F#', label: 'F#', isBlack: true },
  { key: 'F', label: 'F', isBlack: false },
  { key: 'E', label: 'E', isBlack: false },
  { key: 'D#', label: 'D#', isBlack: true },
  { key: 'D', label: 'D', isBlack: false },
  { key: 'C#', label: 'C#', isBlack: true },
  { key: 'C', label: 'C', isBlack: false, strongBorder: true },
  { key: 'B', label: 'B', isBlack: false },
  { key: 'A#', label: 'A#', isBlack: true },
  { key: 'A', label: 'A', isBlack: false, strongBorder: true },
];

export function renderVocalSheetNotesHTML(options: VocalPaperPrintOptions): string {
  const code = options.sheetType === 'notes_2m' ? 'CHANT-NOTES-2M' : 'CHANT-NOTES-1M';
  const blocksCount = options.patternsCount ?? 3;
  const startP = options.startPatternNumber ?? 1;
  const isBlankLabel = Boolean(options.blankPatternLabels || options.patternNumberingMode === 'blank');
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '______________________';
  const rowH = '1.8mm';

  const blankTempsCells = Array.from({ length: 8 }, () =>
    `<th colspan="4" class="beat-sep-right open-temps-cell" style="height:5.5mm;border-right:1.5px solid #000000;font-size:8pt;font-weight:900;"></th>`
  ).join('');

  const octBeatCells = Array.from({ length: 8 }, () =>
    `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:5.5mm;border-right:1.5px solid #000000;font-size:7.5pt;font-weight:900;"></td>`
  ).join('');

  const openSylBeatCells = Array.from({ length: 8 }, () =>
    `<td colspan="4" class="beat-sep-right open-beat-cell" style="height:11.5mm;border-right:1.5px solid #000000;font-size:8.5pt;font-weight:900;"></td>`
  ).join('');

  const subGridCells = Array.from({ length: 32 }, (_, idx) => {
    const isBeatEnd = (idx + 1) % 4 === 0;
    const cls = isBeatEnd ? 'beat-sep-right' : 'sub-sep-right';
    const bdr = isBeatEnd ? 'border-right:1.5px solid #000000;' : 'border-right:1px dotted #000000;';
    return `<td class="${cls}" style="height:${rowH};padding:0;line-height:1;${bdr}"></td>`;
  }).join('');

  const renderSinglePatternBlock = (idx: number) => {
    const patLabel = isBlankLabel ? '[P__]' : `[P${startP + idx}]`;
    const keyboardRowsHtml = VOCAL_PAPER_KEYBOARD_ROWS.map((k) => {
      const bottomBorder = k.strongBorder ? 'border-bottom:1.8px solid #000000;' : '';
      const keyCellClass = k.isBlack ? 'hatch-bw' : '';
      const labelHtml = k.isBlack
        ? `<span style="background:#ffffff;padding:0 1px;font-size:5.5pt;font-weight:900;line-height:1;">${k.label}</span>`
        : `<span style="font-size:6.5pt;font-weight:900;line-height:1;">${k.label}</span>`;
      return `<tr data-note-row="${k.key}" style="height:${rowH};${bottomBorder}"><td class="${keyCellClass}" style="width:8.5mm;height:${rowH};padding:0;line-height:1;font-size:6.5pt;border-right:2px solid #000000;">${labelHtml}</td>${subGridCells}</tr>`;
    }).join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000000;page-break-inside:avoid;break-inside:avoid;">
        <table><tbody>
          <tr style="border-bottom:1.5px solid #000000;">
            <th style="width:8.5mm;height:5.5mm;border-right:2px solid #000000;padding:0;line-height:1;">
              <span style="font-size:7pt;font-weight:900;">${patLabel}</span>
              <span style="font-size:4.4pt;font-weight:800;display:block;">TEMPS</span>
            </th>
            ${blankTempsCells}
          </tr>
          <tr style="border-bottom:1.8px solid #000000;">
            <td style="width:8.5mm;height:5.5mm;font-size:5pt;font-weight:900;border-right:2px solid #000000;padding:0;line-height:1;">OCT<br/>3/4/5</td>
            ${octBeatCells}
          </tr>
          ${keyboardRowsHtml}
          <tr style="border-top:2px solid #000000;">
            <td style="width:8.5mm;height:11.5mm;font-size:5.2pt;font-weight:900;border-right:2px solid #000000;padding:0;line-height:1;">SYL</td>
            ${openSylBeatCells}
          </tr>
        </tbody></table>
      </div>`;
  };

  return `
    <div class="vocal-sheet-page vocal-print-page">
      ${renderFiducialCornersHTML()}
      <div style="height:5.5mm;max-height:6mm;border-bottom:2px solid #000000;padding-bottom:0.5mm;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:baseline;gap:6px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:8.8pt;font-weight:900;text-transform:uppercase;">FEUILLE 2 — PATTERNS & NOTES (A4 PAYSAGE • 3 LIGNES • A EN BAS ➔ G# EN HAUT)</span>
          <span style="font-size:6pt;font-weight:700;">• TITRE : ${titleText} • TEMPS (1..4) • Trait (───) = note • SYLLABES sous le trait</span>
        </div>
        ${renderOpticalSheetCodeBadge(code)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:3mm;">${Array.from({ length: blocksCount }, (_, i) => renderSinglePatternBlock(i)).join('')}</div>
    </div>`;
}
