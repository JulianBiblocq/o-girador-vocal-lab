/**
 * vocalSheetSequenceTemplate.ts
 * Feuille 1 : Séquence & Conducteur Vocal A4 Portrait 100 % Noir & Blanc ([CODE: CHANT-SEQ]) (< 130 lignes).
 * Grilles de mesures M1 à M32 à 2 lignes superposées (Pux / Cor) pour attribuer les patterns neutres P1..Pn.
 */
import type { VocalPaperPrintOptions, ScannedSequenceMeasureColumn } from '../../types/vocalPaperWorkshop.types';
import {
  renderFiducialCornersHTML,
  renderOpticalSheetCodeBadge,
  renderBwCheckbox,
} from './vocalPaperPrintHelper';

export function renderVocalSheetSequenceHTML(
  options: VocalPaperPrintOptions,
  prefillColumns?: ScannedSequenceMeasureColumn[]
): string {
  const titleText = options.title?.trim() ? options.title.trim().toUpperCase() : '____________________________';
  const bpmText = options.bpm ? String(options.bpm) : '____';
  const sig = options.timeSignature || '4/4';
  const sungKey = options.sungKey || '';
  const troupeKey = options.troupeKey || '______';

  const colMap = new Map<number, ScannedSequenceMeasureColumn>();
  (prefillColumns || []).forEach((c) => colMap.set(c.measureNumber, c));

  const renderSystemBlock = (startMeasure: number, count = 8) => {
    const headers = Array.from({ length: count }, (_, i) => {
      const m = startMeasure + i;
      return `<th style="height:20px;font-size:8.5pt;font-weight:900;background:#fff;border:1.5px solid #000;">M${m}</th>`;
    }).join('');

    const puxCells = Array.from({ length: count }, (_, i) => {
      const m = startMeasure + i;
      const val = colMap.get(m)?.puxCode || '';
      return `<td style="height:36px;font-size:12pt;font-weight:900;font-family:monospace;border:1.5px solid #000;">${val}</td>`;
    }).join('');

    const corCells = Array.from({ length: count }, (_, i) => {
      const m = startMeasure + i;
      const val = colMap.get(m)?.corCode || '';
      return `<td style="height:36px;font-size:12pt;font-weight:900;font-family:monospace;border:1.5px solid #000;">${val}</td>`;
    }).join('');

    return `
      <div style="border:2px solid #000;margin-bottom:6px;">
        <div style="padding:2px 6px;font-size:8pt;font-weight:900;border-bottom:1.5px solid #000;display:flex;justify-content:space-between;">
          <span>SYSTÈME MESURES M${startMeasure} À M${startMeasure + count - 1}</span>
          <span>ÉCRIRE : P1, P2... OU X (SILENCE)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:22mm;font-size:8pt;font-weight:900;border:1.5px solid #000;">RÔLE</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-size:9.5pt;font-weight:900;border:1.5px solid #000;padding:2px 4px;">PUX :</td>
              ${puxCells}
            </tr>
            <tr>
              <td style="font-size:9.5pt;font-weight:900;border:1.5px solid #000;padding:2px 4px;">COR :</td>
              ${corCells}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const systemsHtml = [1, 9, 17, 25].map((start) => renderSystemBlock(start, 8)).join('');

  const memoRows = Array.from({ length: 4 }, (_, r) => {
    const pLeft = r * 2 + 1;
    const pRight = r * 2 + 2;
    return `<tr>
      <td style="width:14mm;height:20px;font-weight:900;font-size:8.5pt;">P${pLeft}</td>
      <td style="text-align:left;padding-left:6px;font-size:8pt;">Incipit : _____________________________________</td>
      <td style="width:14mm;height:20px;font-weight:900;font-size:8.5pt;">P${pRight}</td>
      <td style="text-align:left;padding-left:6px;font-size:8pt;">Incipit : _____________________________________</td>
    </tr>`;
  }).join('');

  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="border-bottom:2.5px solid #000;padding-bottom:4px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:12.5pt;font-weight:900;letter-spacing:0.4px;text-transform:uppercase;">
            FEUILLE 1 — SÉQUENCE & CONDUCTEUR DU CHANT (PUXADOR / CORO)
          </div>
          ${renderOpticalSheetCodeBadge('CHANT-SEQ')}
        </div>
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;font-size:8.5pt;font-weight:800;padding:3px 0;">
          <span>TITRE : ${titleText}</span>
          <span>BPM : [ ${bpmText} ]</span>
          <span>SIGNATURE : ${renderBwCheckbox(sig === '4/4', '4/4')} ${renderBwCheckbox(sig === '6/8', '6/8')}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;font-size:8.5pt;font-weight:800;padding-top:2px;">
          <span>BASE D'ÉCRITURE : ${renderBwCheckbox(sungKey === 'A', 'La (A)')} ${renderBwCheckbox(sungKey === 'C', 'Do (C)')} [ Autre : ____ ]</span>
          <span>TONALITÉ TROUPE : [ ${troupeKey} ]</span>
          <span>MODE : ${renderBwCheckbox(options.scaleMode === 'major', 'Maj')} ${renderBwCheckbox(options.scaleMode === 'natural_minor', 'Min')} ${renderBwCheckbox(options.scaleMode === 'mixolydian', 'Mixo')} ${renderBwCheckbox(options.scaleMode === 'dorian', 'Dor')}</span>
        </div>
      </div>

      <div style="border:1.5px dashed #000;padding:4px 8px;margin-bottom:6px;font-size:7.8pt;font-weight:700;line-height:1.35;">
        RÈGLES DE LA GRILLE : Inscrire le code du Pattern neutre (<b>P1, P2, P3...</b>) ou <b>X</b> (silence) dans chaque mesure.<br/>
        • <b>Alternance :</b> Pux = P1 / Cor = X, puis Pux = X / Cor = P2 &nbsp;|&nbsp;
        • <b>Unisson :</b> P5 sur Pux ET P5 sur Cor à la même mesure &nbsp;|&nbsp;
        • <b>2 Voix :</b> P5 sur Pux et P6 sur Cor &nbsp;|&nbsp;
        • <b>Pause Batuque :</b> X sur Pux ET X sur Cor = [PAUSE 1M].
      </div>

      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
        ${systemsHtml}
      </div>

      <div style="margin-top:4px;">
        <div style="font-size:8pt;font-weight:900;margin-bottom:2px;text-transform:uppercase;">
          INDEX AIDE-MÉMOIRE DES PATTERNS (OPTIONNEL — POUR REPÉRAGE PERSONNEL)
        </div>
        <table><tbody>${memoRows}</tbody></table>
      </div>
    </div>
  `;
}
