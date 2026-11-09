/**
 * vocalSheetNotesTemplate.ts
 * Feuille 2 : Patterns & Notes A4 100 % Noir & Blanc ([CODE: CHANT-NOTES-1M] 5 blocs Portrait / [CODE: CHANT-NOTES-2M] 4 blocs Paysage) (< 115 lignes).
 * Clavier ultra-compact 1 octave (La..Sol#, 2.2mm/ligne, étiquette 12mm), bande OCTAVE (6mm, colspan=4) et bande SYLLABES ouverte (9.5mm, colspan=4).
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

function buildPatternColumnsMeta(measuresPerBlock: 1 | 2) {
  const cols: Array<{ group: 'ana' | 'main' | 'tail'; beatLabel: string; sub: number; sepClass: string }> = [];
  for (let b = 3; b <= 4; b++) {
    for (let s = 1; s <= 4; s++) {
      cols.push({ group: 'ana', beatLabel: `Ana T${b}`, sub: s, sepClass: b === 4 && s === 4 ? 'measure-sep-right' : s === 4 ? 'beat-sep-right' : '' });
    }
  }
  const totalMainBeats = measuresPerBlock * 4;
  for (let b = 1; b <= totalMainBeats; b++) {
    const mNum = Math.floor((b - 1) / 4) + 1, bInM = ((b - 1) % 4) + 1;
    for (let s = 1; s <= 4; s++) {
      cols.push({
        group: 'main', beatLabel: measuresPerBlock > 1 ? `M${mNum}•T${bInM}` : `T${bInM}`, sub: s,
        sepClass: bInM === 4 && s === 4 ? 'measure-sep-right' : s === 4 ? 'beat-sep-right' : '',
      });
    }
  }
  for (let s = 1; s <= 4; s++) cols.push({ group: 'tail', beatLabel: '+T1', sub: s, sepClass: s === 4 ? 'beat-sep-right' : '' });
  return cols;
}

export function renderVocalSheetNotesHTML(options: VocalPaperPrintOptions): string {
  const is2M = options.sheetType === 'notes_2m', code = is2M ? 'CHANT-NOTES-2M' : 'CHANT-NOTES-1M';
  const measuresPerBlock: 1 | 2 = is2M ? 2 : 1, blocksCount = options.patternsCount ?? (is2M ? 4 : 5);
  const startP = options.startPatternNumber ?? 1, cols = buildPatternColumnsMeta(measuresPerBlock), rowH = '2.2mm';

  const renderSinglePatternBlock = (idx: number) => {
    const patNum = startP + idx;
    const subGridCells = cols.map((c) => `<td class="${c.sepClass}" style="height:${rowH};"></td>`).join('');
    const beatHeaders: string[] = [], octBeatCells: string[] = [], openSylBeatCells: string[] = [];
    for (let i = 0; i < cols.length; i += 4) {
      const c = cols[i], sep = cols[i + 3]?.sepClass || 'beat-sep-right';
      beatHeaders.push(`<th colspan="4" class="${sep}" style="font-size:6.2pt;font-weight:900;height:2.8mm;">${c.beatLabel}</th>`);
      octBeatCells.push(`<td colspan="4" class="${sep} open-beat-cell" style="height:6mm;font-size:7.5pt;font-weight:900;"></td>`);
      openSylBeatCells.push(`<td colspan="4" class="${sep} open-beat-cell" style="height:9.5mm;font-size:8pt;font-weight:900;"></td>`);
    }
    const subHeaders = cols.map((c) => `<td class="${c.sepClass}" style="font-size:5.2pt;height:2.2mm;font-weight:700;">${c.sub}</td>`).join('');
    const keyboardRowsHtml = VOCAL_PAPER_KEYBOARD_ROWS.map((k) => {
      const topBorder = k.strongBorder ? 'border-top:1.8px solid #000;' : '', keyCellClass = k.isBlack ? 'hatch-bw' : '';
      const labelSpan = k.isBlack
        ? `<span style="background:#fff;padding:0 1.5px;border:1px solid #000;font-size:5.6pt;font-weight:900;">${k.label}</span>`
        : `<span style="font-size:5.8pt;font-weight:900;">${k.label}</span>`;
      return `<tr style="${topBorder}"><td class="${keyCellClass}" style="width:12mm;height:${rowH};text-align:left;padding-left:1.5px;border-right:2px solid #000;line-height:1;">${labelSpan}</td>${subGridCells}</tr>`;
    }).join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000;margin-bottom:1.2mm;page-break-inside:avoid;break-inside:avoid;">
        <div style="padding:0.6mm 4px;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;align-items:center;font-size:7pt;font-weight:900;line-height:1.1;">
          <span>[ PATTERN : P${patNum} ]</span>
          <span style="font-size:6pt;font-weight:700;">Trait horizontal (───) = attaque & durée • Ana T3-T4 & +T1 détectés automatiquement</span>
        </div>
        <table><tbody>
          <tr><th rowspan="2" style="width:12mm;font-size:5.8pt;font-weight:900;border-right:2px solid #000;">TEMPS</th>${beatHeaders.join('')}</tr>
          <tr style="border-bottom:1.5px solid #000;">${subHeaders}</tr>
          <tr style="border-bottom:1.8px solid #000;"><td style="width:12mm;height:6mm;font-size:5.6pt;font-weight:900;border-right:2px solid #000;line-height:1.05;">OCT / ±<br/>(3/4/5)</td>${octBeatCells.join('')}</tr>
          ${keyboardRowsHtml}
          <tr style="border-top:2px solid #000;"><td style="width:12mm;height:9.5mm;font-size:5.8pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>${openSylBeatCells.join('')}</tr>
        </tbody></table>
      </div>`;
  };

  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="border-bottom:2px solid #000;padding-bottom:1.5px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9.8pt;font-weight:900;text-transform:uppercase;">FEUILLE 2 — PATTERNS & NOTES (${is2M ? 'PAYSAGE • 4 BLOCS DE 2 MESURES' : 'PORTRAIT • 5 BLOCS DE 1 MESURE'})</div>
          <div style="font-size:6.6pt;font-weight:700;">Clavier 1 octave (La ➔ Sol#) • Tracer un trait horizontal (───) pour la note • Écrire les SYLLABES sous le début du trait</div>
        </div>
        ${renderOpticalSheetCodeBadge(code)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">${Array.from({ length: blocksCount }, (_, i) => renderSinglePatternBlock(i)).join('')}</div>
    </div>`;
}
