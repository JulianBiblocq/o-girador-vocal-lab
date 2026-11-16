/**
 * twoStaffSvgPrimitives.ts
 * Primitives vectorielles SVG Noir & Blanc A4 Portrait pour la Partition 2 Portées :
 * Clé Sol / Sol 8vb, armure, figures rythmiques, ligatures, soupirs, ties, slurs, triolets et paroles (< 130 lignes).
 */
import type { ResolvedStaffClef } from './scoreTheoryHelper';
import type { QuantizedNoteFigure } from './rhythmQuantizerToFigures';

export const escXml = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SHARP_STAFF_POS = [8, 5, 9, 6, 3, 7, 4], FLAT_STAFF_POS = [4, 7, 3, 6, 2, 5, 1];
export const staffPosToY = (staffTopY: number, lineSpacing: number, posFromBottomE4: number): number => (staffTopY + 4 * lineSpacing) - posFromBottomE4 * (lineSpacing / 2);

export function renderClefKeyTimeSvg(
  xStart: number, staffTopY: number, ls: number, clef: ResolvedStaffClef, fifths: number, showTimeSig: boolean, beats: number, beatType: number
): { svg: string; widthUsed: number } {
  let x = xStart + 6, out = `<text x="${x}" y="${staffTopY + ls * 3.35}" font-family="serif" font-size="${ls * 4.6}" fill="#000">&#119070;</text>`;
  if (clef === 'treble_8vb') out += `<text x="${x + 5}" y="${staffTopY + ls * 5.2}" font-family="monospace" font-weight="900" font-size="9" fill="#000">8</text>`;
  x += 24;
  const count = Math.min(7, Math.abs(fifths));
  for (let i = 0; i < count; i++) {
    const ay = staffPosToY(staffTopY, ls, fifths > 0 ? SHARP_STAFF_POS[i] : FLAT_STAFF_POS[i]);
    out += `<text x="${x}" y="${ay + 4}" font-family="serif" font-weight="bold" font-size="13" fill="#000">${fifths > 0 ? '&#9839;' : '&#9837;'}</text>`;
    x += 7.5;
  }
  if (count > 0) x += 4;
  if (showTimeSig) {
    out += `<text x="${x + 5}" y="${staffTopY + ls * 1.85}" text-anchor="middle" font-family="serif" font-weight="900" font-size="13" fill="#000">${beats}</text><text x="${x + 5}" y="${staffTopY + ls * 3.85}" text-anchor="middle" font-family="serif" font-weight="900" font-size="13" fill="#000">${beatType}</text>`;
    x += 16;
  }
  return { svg: out, widthUsed: x - xStart + 4 };
}

export function renderMeasureFiguresSvg(
  figs: QuantizedNoteFigure[], x0: number, w: number, staffTopY: number, ls: number, totalDiv12: number
): string {
  let out = '';
  const padL = 10, usableW = Math.max(24, w - 18);
  let curDiv = 0;
  const coords: Array<{ x: number; y: number; stemUp: boolean; stemX: number; stemTipY: number; fig: QuantizedNoteFigure }> = [];

  for (const fig of figs) {
    const fx = fig.isWholeMeasureRest ? x0 + w / 2 : x0 + padL + (curDiv / Math.max(12, totalDiv12)) * usableW;
    curDiv += fig.divisions12;

    if (fig.isRest) {
      const midY = staffTopY + 2 * ls;
      if (fig.isWholeMeasureRest || fig.figureType === 'whole') out += `<rect x="${fx - 6}" y="${staffTopY + ls}" width="12" height="${ls * 0.55}" fill="#000"/>`;
      else if (fig.figureType === 'half') out += `<rect x="${fx - 6}" y="${midY - ls * 0.55}" width="12" height="${ls * 0.55}" fill="#000"/>`;
      else if (fig.figureType === 'quarter') out += `<path d="M${fx - 2},${staffTopY + ls * 0.8} L${fx + 3},${staffTopY + ls * 1.6} L${fx - 2},${staffTopY + ls * 2.3} L${fx + 2},${staffTopY + ls * 3.1} C${fx - 3},${staffTopY + ls * 3.1} ${fx - 4},${staffTopY + ls * 3.6} ${fx - 1},${staffTopY + ls * 3.8}" fill="none" stroke="#000" stroke-width="1.6"/>`;
      else out += `<g><circle cx="${fx - 1.5}" cy="${midY - 2}" r="2" fill="#000"/><line x1="${fx + 1}" y1="${midY - 3}" x2="${fx - 2}" y2="${midY + 6}" stroke="#000" stroke-width="1.4"/>${fig.figureType === '16th' ? `<circle cx="${fx - 2.5}" cy="${midY + 2}" r="1.8" fill="#000"/>` : ''}</g>`;
      coords.push({ x: fx, y: midY, stemUp: true, stemX: fx, stemTipY: midY, fig });
      continue;
    }

    const pos = fig.isRhythmOnly ? 4 : (fig.pitch?.staffPosFromBottomLine ?? 4);
    const ny = staffPosToY(staffTopY, ls, pos);
    for (let lp = -2; lp >= pos; lp -= 2) { const ly = staffPosToY(staffTopY, ls, lp); out += `<line x1="${fx - 7}" y1="${ly}" x2="${fx + 7}" y2="${ly}" stroke="#000" stroke-width="1"/>`; }
    for (let lp = 10; lp <= pos; lp += 2) { const ly = staffPosToY(staffTopY, ls, lp); out += `<line x1="${fx - 7}" y1="${ly}" x2="${fx + 7}" y2="${ly}" stroke="#000" stroke-width="1"/>`; }

    if (!fig.isRhythmOnly && fig.pitch?.accidental) {
      const sym = fig.pitch.accidental === '#' ? '&#9839;' : fig.pitch.accidental === 'b' ? '&#9837;' : '&#9838;';
      out += `<text x="${fx - 11}" y="${ny + 3.5}" font-family="serif" font-size="11" fill="#000">${sym}</text>`;
    }

    const isOpen = fig.figureType === 'whole' || fig.figureType === 'half';
    if (fig.isRhythmOnly) out += `<polygon points="${fx - 4},${ny} ${fx},${ny - 3.5} ${fx + 4},${ny} ${fx},${ny + 3.5}" fill="${isOpen ? '#fff' : '#000'}" stroke="#000" stroke-width="1.2"/>`;
    else out += `<ellipse cx="${fx}" cy="${ny}" rx="4.3" ry="3.1" transform="rotate(-18 ${fx} ${ny})" fill="${isOpen ? '#fff' : '#000'}" stroke="#000" stroke-width="1.2"/>`;
    if (fig.dotted) out += `<circle cx="${fx + 7.5}" cy="${ny - 1.5}" r="1.5" fill="#000"/>`;

    const stemUp = pos < 4, stemX = stemUp ? fx + 4 : fx - 4, stemTipY = stemUp ? ny - 23 : ny + 23;
    if (fig.figureType !== 'whole') out += `<line x1="${stemX}" y1="${ny}" x2="${stemX}" y2="${stemTipY}" stroke="#000" stroke-width="1.2"/>`;
    coords.push({ x: fx, y: ny, stemUp, stemX, stemTipY, fig });

    if (fig.displayLyric) {
      out += `<text x="${fx}" y="${staffTopY + 4 * ls + 18}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8.6" font-weight="700" fill="#000">${escXml(fig.displayLyric)}</text>`;
    }
  }

  // Ligatures (beams) par temps ou crochets isolés
  const byBeat = new Map<number, typeof coords>();
  for (const c of coords) if (!c.fig.isRest && c.fig.beamGroupId !== null) {
    const arr = byBeat.get(c.fig.beamGroupId) || []; arr.push(c); byBeat.set(c.fig.beamGroupId, arr);
  }
  for (const grp of byBeat.values()) {
    if (grp.length >= 2) {
      const a = grp[0], b = grp[grp.length - 1];
      out += `<line x1="${a.stemX}" y1="${a.stemTipY}" x2="${b.stemX}" y2="${b.stemTipY}" stroke="#000" stroke-width="2.6"/>`;
      for (let i = 0; i < grp.length - 1; i++) if (grp[i].fig.figureType === '16th' && grp[i + 1].fig.figureType === '16th') {
        const dy = grp[i].stemUp ? 4 : -4;
        out += `<line x1="${grp[i].stemX}" y1="${grp[i].stemTipY + dy}" x2="${grp[i + 1].stemX}" y2="${grp[i + 1].stemTipY + dy}" stroke="#000" stroke-width="2.2"/>`;
      }
    } else if (grp.length === 1) {
      const c = grp[0], dir = c.stemUp ? 1 : -1;
      out += `<path d="M${c.stemX},${c.stemTipY} Q${c.stemX + 7},${c.stemTipY + 5 * dir} ${c.stemX + 4},${c.stemTipY + 11 * dir}" fill="none" stroke="#000" stroke-width="1.4"/>`;
      if (c.fig.figureType === '16th') out += `<path d="M${c.stemX},${c.stemTipY + 4 * dir} Q${c.stemX + 7},${c.stemTipY + 9 * dir} ${c.stemX + 4},${c.stemTipY + 15 * dir}" fill="none" stroke="#000" stroke-width="1.3"/>`;
    }
  }

  // Ties (───), Slurs (_) et Triolets (┌3┐)
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i], nx = coords[i + 1];
    if (c.fig.tieStart) {
      const x2 = nx ? nx.x : x0 + w - 2, arcY = c.y + (c.stemUp ? 6 : -6), ctrlY = c.y + (c.stemUp ? 12 : -12);
      out += `<path d="M${c.x + 3},${arcY} Q${(c.x + x2) / 2},${ctrlY} ${x2 - 3},${arcY}" fill="none" stroke="#000" stroke-width="1.2"/>`;
    }
    if (c.fig.slurStart && nx) {
      const sy1 = c.y - 8, sy2 = nx.y - 8, cy = Math.min(sy1, sy2) - 9;
      out += `<path d="M${c.x},${sy1} Q${(c.x + nx.x) / 2},${cy} ${nx.x},${sy2}" fill="none" stroke="#000" stroke-width="1.3" stroke-dasharray="none"/>`;
    }
    if (c.fig.tuplet?.start) {
      const endT = coords.slice(i, i + 3).find((k) => k.fig.tuplet?.stop) || coords[Math.min(coords.length - 1, i + 2)];
      const ty = staffTopY - 9;
      out += `<path d="M${c.x - 3},${ty + 4} L${c.x - 3},${ty} L${endT.x + 3},${ty} L${endT.x + 3},${ty + 4}" fill="none" stroke="#000" stroke-width="1"/>`;
      out += `<text x="${(c.x + endT.x) / 2}" y="${ty - 1.5}" text-anchor="middle" font-family="monospace" font-size="8" font-weight="900" fill="#000">3</text>`;
    }
  }
  return out;
}

export function wrapA4PortraitScoreDocument(innerPagesHtml: string, title = 'Partition — O Girador'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escXml(title)}</title><style>
    @page { size: A4 portrait; margin: 8mm; }
    @media print { html, body { width: 194mm; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; filter: grayscale(100%) contrast(105%) !important; } .no-print { display: none !important; } }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .vocal-score-portrait-page { width: 194mm; min-height: 278mm; margin: 0 auto; padding: 3mm; background: #fff; color: #000; page-break-inside: avoid; break-inside: avoid; page-break-after: always; break-after: page; }
    .vocal-score-portrait-page:last-child { page-break-after: auto !important; break-after: auto !important; }
  </style></head><body>${innerPagesHtml}</body></html>`;
}
