/**
 * vocalSheetRhythmTemplate.ts
 * Feuille 3 : Paroles & Rythme Seul A4 Portrait 100 % Noir & Blanc ([CODE: CHANT-RYTHME]) (< 105 lignes).
 * Piste RYTHME / DURÉE (4.5mm, 4 sous-cases/temps pour traits ───) + Bande SYLLABES ouverte (9.5mm, colspan=4 sans sous-cases).
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
      .map((bg) => `<th colspan="4" class="${bg.sep}" style="height:3.2mm;font-size:6.8pt;font-weight:900;">${bg.label}</th>`)
      .join('');
    const subNums = beatGroups
      .map((bg) =>
        [1, 2, 3, 4]
          .map((s) => `<td class="${s === 4 ? bg.sep : ''}" style="height:2.4mm;font-size:5.6pt;font-weight:700;">${s}</td>`)
          .join('')
      )
      .join('');
    const rhythmCells = beatGroups
      .map((bg) =>
        [1, 2, 3, 4]
          .map((s) => `<td class="${s === 4 ? bg.sep : ''}" style="height:4.5mm;font-size:7pt;font-weight:900;"></td>`)
          .join('')
      )
      .join('');
    const openSylBands = beatGroups
      .map((bg) => `<td colspan="4" class="${bg.sep} open-beat-cell" style="height:9.5mm;font-size:8.2pt;font-weight:900;"></td>`)
      .join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000;margin-bottom:2mm;page-break-inside:avoid;break-inside:avoid;">
        <div style="padding:0.8mm 5px;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;align-items:center;font-size:7.4pt;font-weight:900;">
          <span>[ PATTERN : P${patNum} ]</span>
          <span style="font-size:6.2pt;font-weight:700;">Trait horizontal (───) dans RYTHME / DURÉE • Syllabes dessous • Ana T3-T4 & +T1 auto</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:12mm;font-size:6pt;font-weight:900;border-right:2px solid #000;">TEMPS</th>
              ${headers}
            </tr>
            <tr>
              <td style="width:12mm;font-size:5.5pt;font-weight:800;border-right:2px solid #000;">1e..4e</td>
              ${subNums}
            </tr>
          </thead>
          <tbody>
            <tr style="border-top:1.8px solid #000;">
              <td style="width:12mm;height:4.5mm;font-size:5.5pt;font-weight:900;border-right:2px solid #000;line-height:1.05;">RYTHME<br/>/ DURÉE</td>
              ${rhythmCells}
            </tr>
            <tr style="border-top:2px solid #000;">
              <td style="width:12mm;height:9.5mm;font-size:6pt;font-weight:900;border-right:2px solid #000;">SYLLABES</td>
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
      <div style="border-bottom:2px solid #000;padding-bottom:2px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10.5pt;font-weight:900;text-transform:uppercase;">
            FEUILLE 3 — PAROLES & RYTHME SEUL (SANS CLAVIER DE NOTES)
          </div>
          <div style="font-size:6.8pt;font-weight:700;">
            TITRE : ${titleText} • Tracer un trait (───) dans RYTHME / DURÉE • Écrire la SYLLABE dessous • Tiret "-" = même mot • "E'O" = élision
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
