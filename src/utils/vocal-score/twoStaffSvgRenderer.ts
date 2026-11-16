/**
 * twoStaffSvgRenderer.ts
 * Rendu SVG vectoriel A4 Portrait Noir & Blanc autonome de la Partition Chorale à 2 Portées
 * (Portée 1 = Puxador, Portée 2 = Coro, crochet choral, accords harmonyGrid, pauses Baque, syllabes) (< 125 lignes).
 */
import { buildTwoStaffMeasures, type TwoStaffScoreModel, type TwoStaffMeasure } from './stepsToTwoStaffMeasures';
import { quantizeMeasureStepsToFigures } from './rhythmQuantizerToFigures';
import type { ClefModeOption } from './scoreTheoryHelper';
import { escXml, renderClefKeyTimeSvg, renderMeasureFiguresSvg, wrapA4PortraitScoreDocument } from './twoStaffSvgPrimitives';

export interface TwoStaffSvgRenderResult {
  model: TwoStaffScoreModel;
  svgPages: string[];
  fullHtml: string;
}

function drawFiveStaffLines(x0: number, x1: number, topY: number, ls: number): string {
  let out = '';
  for (let l = 0; l < 5; l++) {
    const y = topY + l * ls;
    out += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#000" stroke-width="0.9"/>`;
  }
  return out;
}

export function renderTwoStaffScoreSvgPages(
  projectOrPack: any,
  options: { clefMode?: ClefModeOption; measuresPerSystem?: number; systemsPerPage?: number } = {}
): TwoStaffSvgRenderResult {
  const model = buildTwoStaffMeasures(projectOrPack, { clefMode: options.clefMode || 'auto' });
  const measPerSys = options.measuresPerSystem || 3;
  const sysPerPage = options.systemsPerPage || 4;
  const W = 794, H = 1123, leftM = 54, rightM = W - 26, ls = 6.5;

  const systems: TwoStaffMeasure[][] = [];
  for (let i = 0; i < model.measures.length; i += measPerSys) {
    systems.push(model.measures.slice(i, i + measPerSys));
  }
  if (systems.length === 0) {
    systems.push([{ measureNumber: 1, isPickup: false, beatsCount: model.beatsPerMeasure, isBaquePause: false, isUnison: false, chords: [], puxSteps: [], corSteps: [] }]);
  }

  const svgPages: string[] = [];
  const totalPages = Math.max(1, Math.ceil(systems.length / sysPerPage));

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageSystems = systems.slice(pIdx * sysPerPage, (pIdx + 1) * sysPerPage);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="background:#fff;color:#000;display:block;">`;

    // En-tête de partition A4 Portrait
    if (pIdx === 0) {
      svg += `<text x="${W / 2}" y="42" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="900" fill="#000">${escXml(model.title.toUpperCase())}</text>`;
      const subParts = [`Tempo : &#9833; = ${model.bpm} BPM`, `Tonalité Troupe : ${model.troupeKeyLabel}`, `${model.beatsPerMeasure}/${model.beatType}`];
      if (model.diapasonLabel) subParts.push(model.diapasonLabel);
      svg += `<text x="${W / 2}" y="62" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#000">${subParts.map((s) => (s.includes('&#') ? s : escXml(s))).join('  •  ')}</text>`;
      svg += `<line x1="${leftM}" y1="72" x2="${rightM}" y2="72" stroke="#000" stroke-width="1.5"/>`;
    } else {
      svg += `<text x="${rightM}" y="34" text-anchor="end" font-family="monospace" font-size="10" font-weight="700" fill="#000">${escXml(model.title)} — Page ${pIdx + 1}/${totalPages}</text>`;
    }

    const firstSysY = pIdx === 0 ? 112 : 68;
    const sysGapY = 236;

    pageSystems.forEach((sysMeasures, sLocalIdx) => {
      const isVeryFirstSys = pIdx === 0 && sLocalIdx === 0;
      const puxTopY = firstSysY + sLocalIdx * sysGapY;
      const corTopY = puxTopY + 86;
      const corBottomY = corTopY + 4 * ls;

      // Crochet choral gauche + barres de début/fin + étiquettes Pux. / Cor.
      svg += `<path d="M${leftM - 5},${puxTopY - 3} L${leftM - 1},${puxTopY - 3} L${leftM - 5},${puxTopY} L${leftM - 5},${corBottomY} L${leftM - 1},${corBottomY + 3} L${leftM - 5},${corBottomY + 3}" fill="none" stroke="#000" stroke-width="2.4"/>`;
      svg += `<line x1="${leftM}" y1="${puxTopY}" x2="${leftM}" y2="${corBottomY}" stroke="#000" stroke-width="1.6"/>`;
      svg += `<text x="${leftM - 10}" y="${puxTopY + 2.4 * ls}" text-anchor="end" font-family="monospace" font-size="10" font-weight="900" fill="#000">Pux.</text>`;
      svg += `<text x="${leftM - 10}" y="${corTopY + 2.4 * ls}" text-anchor="end" font-family="monospace" font-size="10" font-weight="900" fill="#000">Cor.</text>`;

      svg += drawFiveStaffLines(leftM, rightM, puxTopY, ls);
      svg += drawFiveStaffLines(leftM, rightM, corTopY, ls);

      const puxHead = renderClefKeyTimeSvg(leftM, puxTopY, ls, model.puxClef, model.keySig.fifths, isVeryFirstSys, model.beatsPerMeasure, model.beatType);
      const corHead = renderClefKeyTimeSvg(leftM, corTopY, ls, model.corClef, model.keySig.fifths, isVeryFirstSys, model.beatsPerMeasure, model.beatType);
      svg += puxHead.svg + corHead.svg;

      const contentX0 = leftM + Math.max(puxHead.widthUsed, corHead.widthUsed);
      const availW = rightM - contentX0;
      const weights = sysMeasures.map((m) => (m.isPickup ? Math.max(0.45, m.beatsCount / model.beatsPerMeasure) : 1));
      const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

      let mx = contentX0;
      sysMeasures.forEach((meas, mIdx) => {
        const mw = (weights[mIdx] / weightSum) * availW;
        const mLabel = meas.isPickup ? 'Ana.' : `M${meas.measureNumber}`;
        svg += `<text x="${mx + 3}" y="${puxTopY - 8}" font-family="monospace" font-size="8.5" font-weight="700" fill="#000">${mLabel}${meas.isUnison ? ' (Unisson)' : ''}</text>`;

        // Accords au-dessus de la portée supérieure (Puxador)
        for (const ch of meas.chords) {
          const cx = mx + 10 + ((ch.beat - 1) / Math.max(1, meas.beatsCount)) * (mw - 18);
          svg += `<text x="${cx}" y="${puxTopY - 19}" font-family="monospace" font-size="10" font-weight="900" fill="#000">${escXml(ch.symbol)}</text>`;
        }

        if (meas.isBaquePause && meas.pauseLabel) {
          svg += `<text x="${mx + mw / 2}" y="${(puxTopY + 4 * ls + corTopY) / 2 + 4}" text-anchor="middle" font-family="monospace" font-size="9.5" font-weight="900" fill="#000">[ ${escXml(meas.pauseLabel)} ]</text>`;
        }

        const puxFigs = quantizeMeasureStepsToFigures(meas.puxSteps, meas.beatsCount, model.keySig.fifths, model.puxClef, Boolean(meas.puxRhythmOnly));
        const corFigs = quantizeMeasureStepsToFigures(meas.corSteps, meas.beatsCount, model.keySig.fifths, model.corClef, Boolean(meas.corRhythmOnly));
        const div12 = meas.beatsCount * 12;
        svg += renderMeasureFiguresSvg(puxFigs, mx, mw, puxTopY, ls, div12);
        svg += renderMeasureFiguresSvg(corFigs, mx, mw, corTopY, ls, div12);

        const barX = mx + mw;
        const isFinalMeas = pIdx === totalPages - 1 && sLocalIdx === pageSystems.length - 1 && mIdx === sysMeasures.length - 1;
        svg += `<line x1="${barX}" y1="${puxTopY}" x2="${barX}" y2="${corBottomY}" stroke="#000" stroke-width="${isFinalMeas ? '2.4' : '1.1'}"/>`;
        if (isFinalMeas) svg += `<line x1="${barX - 4}" y1="${puxTopY}" x2="${barX - 4}" y2="${corBottomY}" stroke="#000" stroke-width="1"/>`;
        mx = barX;
      });
    });

    svg += `</svg>`;
    svgPages.push(svg);
  }

  const innerHtml = svgPages.map((s) => `<div class="vocal-score-portrait-page">${s}</div>`).join('\n');
  return { model, svgPages, fullHtml: wrapA4PortraitScoreDocument(innerHtml, `${model.title} — Partition 2 Portées`) };
}
