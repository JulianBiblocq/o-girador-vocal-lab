/**
 * vocalSheetNotesTemplate.ts
 * Feuille 2 : Patterns & Notes A4 100 % Noir & Blanc ([CODE: CHANT-NOTES-1M] Portrait / [CODE: CHANT-NOTES-2M] Paysage) (< 130 lignes).
 * Clavier vertical 1 octave commençant par La (La..Sol#), touches noires hachurées N&B, ligne OCT / ±, Ana T3-T4, +T1 et Syllabes.
 */
import type { VocalPaperPrintOptions, KeyboardOctaveNote } from '../../types/vocalPaperWorkshop.types';
import { renderFiducialCornersHTML, renderOpticalSheetCodeBadge, renderBwCheckbox } from './vocalPaperPrintHelper';

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
      cols.push({ group: 'ana', beatLabel: `A${b}`, sub: s, sepClass: b === 4 && s === 4 ? 'measure-sep-right' : s === 4 ? 'beat-sep-right' : '' });
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
  const measuresPerBlock: 1 | 2 = is2M ? 2 : 1, blocksCount = options.patternsCount ?? (is2M ? 2 : 3);
  const startP = options.startPatternNumber ?? 1, cols = buildPatternColumnsMeta(measuresPerBlock), rowH = is2M ? '11.5px' : '11px';

  const renderSinglePatternBlock = (idx: number) => {
    const patNum = startP + idx;
    const emptyCells = cols.map((c) => `<td class="${c.sepClass}" style="height:${rowH};"></td>`).join('');
    const beatHeaders: string[] = [];
    for (let i = 0; i < cols.length; i += 4) {
      const c = cols[i], sep = cols[i + 3]?.sepClass || 'beat-sep-right';
      beatHeaders.push(`<th colspan="4" class="${sep}" style="font-size:7pt;font-weight:900;height:13px;">${c.beatLabel}</th>`);
    }
    const subHeaders = cols.map((c) => `<td class="${c.sepClass}" style="font-size:6pt;height:10px;font-weight:700;">${c.sub}</td>`).join('');
    const keyboardRowsHtml = VOCAL_PAPER_KEYBOARD_ROWS.map((k) => {
      const topBorder = k.strongBorder ? 'border-top:2px solid #000;' : '', keyCellClass = k.isBlack ? 'hatch-bw' : '';
      const labelSpan = k.isBlack
        ? `<span style="background:#fff;padding:0 2px;border:1px solid #000;font-size:6.5pt;font-weight:900;">${k.label}</span>`
        : `<span style="font-size:7pt;font-weight:900;">${k.label}</span>`;
      return `<tr style="${topBorder}"><td class="${keyCellClass}" style="width:16mm;height:${rowH};text-align:left;padding-left:2px;border-right:2px solid #000;">${labelSpan}</td>${emptyCells}</tr>`;
    }).join('');
    const sylCells = cols.map((c) => `<td class="${c.sepClass}" style="height:22px;font-size:7.5pt;font-weight:800;"></td>`).join('');

    return `
      <div style="border:2px solid #000;margin-bottom:5px;">
        <div style="padding:2px 6px;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;align-items:center;font-size:8pt;font-weight:900;">
          <span>[ PATTERN : P${patNum} ] &nbsp; (Neutre — Rôle Pux/Cor défini sur la Feuille Séquence)</span>
          <div style="display:flex;gap:10px;align-items:center;">${renderBwCheckbox(false, 'Anacrouse (Ana T3-T4)')}${renderBwCheckbox(false, 'Chute (+T1)')}</div>
        </div>
        <table><tbody>
          <tr style="border-bottom:1.5px solid #000;"><td style="width:16mm;height:13px;font-size:6.8pt;font-weight:900;border-right:2px solid #000;">OCT / ±</td>${emptyCells}</tr>
          ${keyboardRowsHtml}
          <tr style="border-top:2px solid #000;"><th rowspan="2" style="width:16mm;font-size:6.8pt;font-weight:900;border-right:2px solid #000;">TEMPS</th>${beatHeaders.join('')}</tr>
          <tr>${subHeaders}</tr>
          <tr style="border-top:2px solid #000;"><td style="width:16mm;height:22px;font-size:6.8pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>${sylCells}</tr>
        </tbody></table>
      </div>`;
  };

  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11pt;font-weight:900;text-transform:uppercase;">FEUILLE 2 — PATTERNS & NOTES (${is2M ? 'PAYSAGE • 2 MESURES / LIGNE' : 'PORTRAIT • 1 MESURE / LIGNE'})</div>
          <div style="font-size:7.2pt;font-weight:700;">Clavier 1 octave (La ➔ Sol#) • Noircir la case de note • Syllabes en MAJUSCULES BÂTONS • Tiret "-" = même mot • "───►" = tenue</div>
        </div>
        ${renderOpticalSheetCodeBadge(code)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">${Array.from({ length: blocksCount }, (_, i) => renderSinglePatternBlock(i)).join('')}</div>
    </div>`;
}