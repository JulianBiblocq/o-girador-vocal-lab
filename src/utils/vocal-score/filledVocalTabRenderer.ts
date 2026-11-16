/**
 * filledVocalTabRenderer.ts
 * Rendu A4 Portrait Noir & Blanc d'une feuille autonome de Tablature de Chant remplie à 4 étages :
 * 1. TEMPS (encoches), 2. SUBDIVISIONS (soudées par '/'), 3. NOTES ou 0 (Lettres / Solfège / Degrés), 4. SYLLABES et _ (< 130 lignes).
 */
import { buildTwoStaffMeasures, type ScoreStepLike } from './stepsToTwoStaffMeasures';
import { formatTabPitchToken, type TabPitchNotation } from './scoreTheoryHelper';
import { escXml, wrapA4PortraitScoreDocument } from './twoStaffSvgPrimitives';

export interface FilledVocalTabOptions { notation?: TabPitchNotation; lang?: 'fr' | 'br'; }
interface TabEventCell { startSub: number; lenSub: number; subdivCode: string; noteCode: string; syllableCode: string; }

function buildWeldedSubdivLabel(startStep: number, lenSteps: number): string {
  const parts: number[] = [];
  let cur = startStep, rem = lenSteps;
  while (rem > 0) { const inBeat = Math.min(rem, 4 - (cur % 4)); parts.push(inBeat); cur += inBeat; rem -= inBeat; }
  return parts.join('/');
}

function extractMeasureTabEvents(
  steps: ScoreStepLike[],
  beatsCount: number,
  rootPc: number,
  notation: TabPitchNotation,
  lang: 'fr' | 'br',
  rhythmOnly = false
): TabEventCell[] {
  const total = Math.max(4, beatsCount * 4);
  const norm = Array.from({ length: total }, (_, i) => steps[i] || { stepIndex: i, active: false, midiNumber: 0 });
  const events: TabEventCell[] = [];
  let i = 0;

  while (i < total) {
    const s = norm[i];
    const act = Boolean(s.tripletSlot !== 'unused' && s.active && s.syllable !== '0' && s.syllable !== '𝄽');
    let len = 1;
    if (!act) {
      const restEnd = Math.min(total, (Math.floor(i / 4) + 1) * 4);
      while (i + len < restEnd && !norm[i + len].active) len++;
      events.push({ startSub: i, lenSub: len, subdivCode: String(len), noteCode: '0', syllableCode: '0' });
    } else {
      while (i + len < total && norm[i + len].active && (norm[i + len].isTie || norm[i + len].note === '───')) len++;
      const rawSyl = String(s.syllable || '').trim().replace(/───/g, '');
      const isMel = Boolean(s.isMelisma || rawSyl === '_');
      events.push({
        startSub: i,
        lenSub: len,
        subdivCode: buildWeldedSubdivLabel(i, len),
        noteCode: rhythmOnly ? '—' : formatTabPitchToken(s.midiNumber || 60, rootPc, notation, lang),
        syllableCode: isMel ? '_' : (rawSyl || '•'),
      });
    }
    i += len;
  }
  return events;
}

function renderRoleMeasureRowHtml(
  roleBadge: string,
  measLabel: string,
  beatsCount: number,
  events: TabEventCell[]
): string {
  const totalCols = Math.max(4, beatsCount * 4);
  const beatHeaders = Array.from({ length: beatsCount }, (_, b) =>
    `<th colspan="4" style="border:1px solid #000;border-right:1.6px solid #000;height:4.6mm;font-size:7.5pt;font-weight:900;">T${b + 1}</th>`
  ).join('');
  const renderMergedRow = (label: string, pick: (ev: TabEventCell) => string, bold = false) => {
    const tds = events.map((ev) => {
      const isBeatEnd = (ev.startSub + ev.lenSub) % 4 === 0;
      const val = pick(ev);
      return `<td colspan="${ev.lenSub}" style="border:1px solid #000;${isBeatEnd ? 'border-right:1.6px solid #000;' : 'border-right:1px dotted #000;'}height:5mm;font-size:7.6pt;font-weight:${bold ? '900' : '700'};text-align:center;">${escXml(val)}</td>`;
    }).join('');
    return `<tr><td style="width:22mm;border:1px solid #000;border-right:1.8px solid #000;font-size:6.4pt;font-weight:900;padding:0 2px;text-align:left;">${label}</td>${tds}</tr>`;
  };

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:2.2mm;border:1.8px solid #000;">
    <colgroup><col style="width:22mm;"/>${Array.from({ length: totalCols }, () => '<col/>').join('')}</colgroup>
    <tr><th style="border:1px solid #000;border-right:1.8px solid #000;font-size:7pt;font-weight:900;background:#f3f3f3;">${escXml(measLabel)} • ${escXml(roleBadge)}</th>${beatHeaders}</tr>
    ${renderMergedRow('SUBDIV.', (e) => e.subdivCode)}
    ${renderMergedRow('NOTES / 0', (e) => e.noteCode, true)}
    ${renderMergedRow('SYLLABES', (e) => e.syllableCode, true)}
  </table>`;
}

export function renderFilledVocalTabPortraitHTML(projectOrPack: any, options: FilledVocalTabOptions = {}): { html: string; rowsCount: number } {
  const notation = options.notation || 'letters', lang = options.lang || 'fr';
  const model = buildTwoStaffMeasures(projectOrPack);
  const blocks: string[] = [];

  const hasStepAct = (arr: ScoreStepLike[]) => arr.some((s) => s.active && s.syllable !== '0' && s.syllable !== '𝄽');

  for (const m of model.measures) {
    const mLbl = m.isPickup ? 'Ana.' : `M${m.measureNumber}`;
    if (m.isBaquePause) {
      if (m.pauseLabel) blocks.push(`<div style="border:1.6px dashed #000;padding:1.8mm 3mm;margin-bottom:2mm;font-family:monospace;font-size:8.5pt;font-weight:900;text-align:center;">[ ${escXml(m.pauseLabel)} — Silence vocal (0) ]</div>`);
      continue;
    }
    const pAct = hasStepAct(m.puxSteps), cAct = hasStepAct(m.corSteps);
    if (m.isUnison && pAct) {
      blocks.push(renderRoleMeasureRowHtml('TUTTI', mLbl, m.beatsCount, extractMeasureTabEvents(m.puxSteps, m.beatsCount, model.keySig.rootPc, notation, lang, m.puxRhythmOnly)));
    } else {
      if (pAct) blocks.push(renderRoleMeasureRowHtml('PUX', mLbl, m.beatsCount, extractMeasureTabEvents(m.puxSteps, m.beatsCount, model.keySig.rootPc, notation, lang, m.puxRhythmOnly)));
      if (cAct) blocks.push(renderRoleMeasureRowHtml('COR', mLbl, m.beatsCount, extractMeasureTabEvents(m.corSteps, m.beatsCount, model.keySig.rootPc, notation, lang, m.corRhythmOnly)));
    }
  }

  const pages: string[] = [];
  const perPage = 9;
  for (let i = 0; i < Math.max(1, blocks.length); i += perPage) {
    const slice = blocks.slice(i, i + perPage);
    const header = i === 0
      ? `<div style="border-bottom:2px solid #000;padding-bottom:2mm;margin-bottom:3mm;display:flex;justify-content:space-between;align-items:baseline;font-family:monospace;">
          <div><div style="font-size:13pt;font-weight:900;text-transform:uppercase;">${escXml(model.title)}</div><div style="font-size:8.5pt;font-weight:700;">Tablature de Chant 4 Étages • ${model.bpm} BPM • Tonalité Troupe : ${escXml(model.troupeKeyLabel)}${model.diapasonLabel ? ` • ${escXml(model.diapasonLabel)}` : ''}</div></div>
          <span style="border:1.5px solid #000;padding:1px 6px;font-size:8pt;font-weight:900;">${notation === 'solfege' ? 'SOLFÈGE' : notation === 'degrees' ? 'DEGRÉS' : 'LETTRES'}</span>
        </div>`
      : `<div style="text-align:right;font-family:monospace;font-size:8pt;font-weight:700;margin-bottom:2mm;">${escXml(model.title)} (suite)</div>`;
    pages.push(`<div class="vocal-score-portrait-page">${header}${slice.join('\n')}</div>`);
  }

  return { html: wrapA4PortraitScoreDocument(pages.join('\n'), `${model.title} — Tablature 4 Étages`), rowsCount: blocks.length };
}
