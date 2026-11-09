/**
 * vocalSheetRhythmTemplate.ts
 * Feuille 3 : Paroles & Rythme Seul A4 Paysage Grand Confort ([CODE: CHANT-RYTHME], 7 lignes/page) (< 95 lignes).
 * Cartouche vertical gauche P__ (13mm), bande RYTHME (5.5mm, 4 sous-cases/temps) + bande SYLLABES ouverte (11mm, colspan=4).
 */
import type { VocalPaperPrintOptions } from '../../types/vocalPaperWorkshop.types';
import {
  renderFiducialCornersHTML,
  renderOpticalSheetCodeBadge,
} from './vocalPaperPrintHelper';

export function renderVocalSheetRhythmHTML(options: VocalPaperPrintOptions): string {
  const blocksCount = options.patternsCount ?? 7;
  const startP = options.startPatternNumber ?? 1;
  const measuresPerLine: 1 | 2 = options.rhythmMeasuresPerLine ?? 1;
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '______________________';

  const beatGroups: Array<{ label: string; sep: string }> = [
    { label: 'ANA T3', sep: 'beat-sep-right' },
    { label: 'ANA T4', sep: 'measure-sep-right' },
  ];
  const totalMainBeats = measuresPerLine * 4;
  for (let b = 1; b <= totalMainBeats; b++) {
    const mNum = Math.floor((b - 1) / 4) + 1, bInM = ((b - 1) % 4) + 1;
    beatGroups.push({
      label: measuresPerLine > 1 ? `M${mNum}•T${bInM}` : `TEMPS ${bInM}`,
      sep: bInM === 4 ? 'measure-sep-right' : 'beat-sep-right',
    });
  }
  beatGroups.push({ label: '+T1 (CHUTE)', sep: '' });

  const renderBlock = (idx: number) => {
    const patNum = startP + idx;
    const headers = beatGroups
      .map((bg) => `<th colspan="4" class="${bg.sep}" style="height:3.2mm;font-size:6.4pt;font-weight:900;">${bg.label}</th>`)
      .join('');
    const rhythmCells = beatGroups
      .map((bg) =>
        [1, 2, 3, 4]
          .map((s) => `<td class="${s === 4 ? bg.sep : ''}" style="height:5.5mm;vertical-align:top;text-align:left;padding:0.2mm 0.6mm;font-size:4.8pt;font-weight:700;line-height:1;">${s}</td>`)
          .join('')
      )
      .join('');
    const openSylBands = beatGroups
      .map((bg) => `<td colspan="4" class="${bg.sep} open-beat-cell" style="height:11mm;font-size:8.5pt;font-weight:900;"></td>`)
      .join('');

    return `
      <div class="vocal-pattern-block" style="border:2px solid #000;page-break-inside:avoid;break-inside:avoid;">
        <table>
          <tbody>
            <tr>
              <th rowspan="3" style="width:13mm;border-right:2px solid #000;padding:0 1px;line-height:1.05;">
                <div style="font-size:8.5pt;font-weight:900;">P${patNum}</div>
                <div style="font-size:4.6pt;font-weight:800;margin-top:0.5mm;">RYTHME (───)<br/>▼<br/>SYLLABES</div>
              </th>
              ${headers}
            </tr>
            <tr style="border-top:1.5px solid #000;">
              ${rhythmCells}
            </tr>
            <tr style="border-top:2px solid #000;">
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
      <div style="height:6.5mm;max-height:7mm;border-bottom:2px solid #000;padding-bottom:1mm;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:baseline;gap:6px;overflow:hidden;white-space:nowrap;">
          <span style="font-size:9.5pt;font-weight:900;text-transform:uppercase;">FEUILLE 3 — PAROLES & RYTHME (${measuresPerLine}M / LIGNE • PAYSAGE)</span>
          <span style="font-size:6.5pt;font-weight:700;">• TITRE : ${titleText} • Haut = Trait RYTHME (───) • Bas = SYLLABES (sans sous-cases) • "-" = même mot</span>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-RYTHME')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;gap:2mm;">
        ${blocksHtml}
      </div>
    </div>
  `;
}
