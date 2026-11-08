/**
 * vocalSheetRhythmTemplate.ts
 * Feuille 3 : Paroles & Rythme Seul A4 Portrait 100 % Noir & Blanc ([CODE: CHANT-RYTHME]) (< 120 lignes).
 * 8 blocs neutres [ Pattern : P__ ] sans clavier MIDI : compartiments Ana T3-T4, Temps 1..4 (4 sous-cases) et +T1.
 */
import type { VocalPaperPrintOptions } from '../../types/vocalPaperWorkshop.types';
import {
  renderFiducialCornersHTML,
  renderOpticalSheetCodeBadge,
  renderBwCheckbox,
} from './vocalPaperPrintHelper';

export function renderVocalSheetRhythmHTML(options: VocalPaperPrintOptions): string {
  const blocksCount = options.patternsCount ?? 8;
  const startP = options.startPatternNumber ?? 1;
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '______________________';

  const beatGroups = [
    { label: 'ANA T3', sep: 'beat-sep-right' },
    { label: 'ANA T4', sep: 'measure-sep-right' },
    { label: 'TEMPS 1', sep: 'beat-sep-right' },
    { label: 'TEMPS 2', sep: 'beat-sep-right' },
    { label: 'TEMPS 3', sep: 'beat-sep-right' },
    { label: 'TEMPS 4', sep: 'measure-sep-right' },
    { label: '+T1 (CHUTE)', sep: '' },
  ];

  const renderBlock = (idx: number) => {
    const patNum = startP + idx;
    const headers = beatGroups
      .map((bg) => `<th colspan="4" class="${bg.sep}" style="height:14px;font-size:7pt;font-weight:900;">${bg.label}</th>`)
      .join('');
    const subNums = beatGroups
      .map((bg) =>
        [1, 2, 3, 4]
          .map((s) => `<td class="${s === 4 ? bg.sep : ''}" style="height:11px;font-size:6pt;font-weight:700;">${s}</td>`)
          .join('')
      )
      .join('');
    const sylBoxes = beatGroups
      .map((bg) =>
        [1, 2, 3, 4]
          .map((s) => `<td class="${s === 4 ? bg.sep : ''}" style="height:26px;font-size:8pt;font-weight:900;"></td>`)
          .join('')
      )
      .join('');

    return `
      <div style="border:2px solid #000;margin-bottom:4px;">
        <div style="padding:1.5px 6px;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;align-items:center;font-size:7.8pt;font-weight:900;">
          <span>[ PATTERN : P${patNum} ] &nbsp; (Rythme & Paroles — Sans notes MIDI)</span>
          <div style="display:flex;gap:10px;align-items:center;">
            ${renderBwCheckbox(true, '1 Mesure')}
            ${renderBwCheckbox(false, 'Suite au bloc suivant (2M)')}
            ${renderBwCheckbox(false, 'Anacrouse')}
            ${renderBwCheckbox(false, 'Chute +T1')}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:15mm;font-size:6.5pt;font-weight:900;border-right:2px solid #000;">TEMPS</th>
              ${headers}
            </tr>
            <tr>
              <td style="width:15mm;font-size:6pt;font-weight:800;border-right:2px solid #000;">1e..4e</td>
              ${subNums}
            </tr>
          </thead>
          <tbody>
            <tr style="border-top:2px solid #000;">
              <td style="width:15mm;height:26px;font-size:6.8pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>
              ${sylBoxes}
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
      <div style="border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11.5pt;font-weight:900;text-transform:uppercase;">
            FEUILLE 3 — PAROLES & RYTHME SEUL (SANS CLAVIER DE NOTES)
          </div>
          <div style="font-size:7.5pt;font-weight:700;">
            TITRE : ${titleText} • Écrire 1 syllabe par sous-case (MAJUSCULES) • Tiret "-" = même mot • "E'O" = élision • "───►" = tenue
          </div>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-RYTHME')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
        ${blocksHtml}
      </div>
    </div>
  `;
}

