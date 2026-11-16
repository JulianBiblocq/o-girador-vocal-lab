/**
 * musicXmlTwoStaffExporter.ts
 * Exportateur pur MusicXML 4.0 (`<score-partwise version="4.0">`) ouvrable directement dans MuseScore :
 * P1=Puxador & P2=Coro reliés par `<part-group symbol="bracket"/>`, `<clef-octave-change>-1`, `<fifths>`,
 * `<time>`, `<sound tempo>`, `<harmony>`, `<lyric>`, `<tie>`, `<slur>`, `<tuplet>` et `<rest/>` (< 130 lignes).
 */
import { buildTwoStaffMeasures, type TwoStaffMeasure } from './stepsToTwoStaffMeasures';
import { quantizeMeasureStepsToFigures, type QuantizedNoteFigure } from './rhythmQuantizerToFigures';
import { parseChordSymbolForMusicXml, type ClefModeOption, type ResolvedStaffClef } from './scoreTheoryHelper';
import { escXml } from './twoStaffSvgPrimitives';

function renderFigureXml(fig: QuantizedNoteFigure): string {
  let xml = '      <note>\n';
  if (fig.isRest) xml += fig.isWholeMeasureRest ? '        <rest measure="yes"/>\n' : '        <rest/>\n';
  else {
    const p = fig.pitch!;
    xml += `        <pitch><step>${p.step}</step>${p.alter !== 0 ? `<alter>${p.alter}</alter>` : ''}<octave>${p.octave}</octave></pitch>\n`;
  }
  xml += `        <duration>${fig.divisions12}</duration>\n`;
  if (!fig.isRest && fig.tieStop) xml += '        <tie type="stop"/>\n';
  if (!fig.isRest && fig.tieStart) xml += '        <tie type="start"/>\n';
  xml += `        <voice>1</voice>\n        <type>${fig.figureType}</type>\n`;
  if (fig.dotted) xml += '        <dot/>\n';
  if (fig.tuplet) xml += `        <time-modification><actual-notes>${fig.tuplet.actual}</actual-notes><normal-notes>${fig.tuplet.normal}</normal-notes></time-modification>\n`;

  const nots: string[] = [];
  if (!fig.isRest && fig.tieStop) nots.push('<tied type="stop"/>');
  if (!fig.isRest && fig.tieStart) nots.push('<tied type="start"/>');
  if (fig.slurStart) nots.push('<slur type="start" number="1"/>');
  if (fig.slurStop) nots.push('<slur type="stop" number="1"/>');
  if (fig.tuplet?.start) nots.push('<tuplet type="start" bracket="yes"/>');
  if (fig.tuplet?.stop) nots.push('<tuplet type="stop"/>');
  if (nots.length > 0) xml += `        <notations>${nots.join('')}</notations>\n`;
  if (!fig.isRest && fig.lyricText) xml += `        <lyric number="1"><syllabic>${fig.syllabic || 'single'}</syllabic><text>${escXml(fig.lyricText)}</text></lyric>\n`;
  return `${xml}      </note>\n`;
}

function renderHarmonyXml(symbol: string): string {
  const h = parseChordSymbolForMusicXml(symbol);
  if (!h) return '';
  let out = `      <harmony><root><root-step>${h.rootStep}</root-step>${h.rootAlter !== 0 ? `<root-alter>${h.rootAlter}</root-alter>` : ''}</root><kind text="${escXml(h.display)}">${h.kind}</kind>`;
  if (h.bassStep) out += `<bass><bass-step>${h.bassStep}</bass-step>${h.bassAlter ? `<bass-alter>${h.bassAlter}</bass-alter>` : ''}</bass>`;
  return `${out}</harmony>\n`;
}

export function exportTwoStaffMusicXml(projectOrPack: any, options: { clefMode?: ClefModeOption } = {}): string {
  const model = buildTwoStaffMeasures(projectOrPack, { clefMode: options.clefMode || 'auto' });

  const renderPartMeasures = (partId: 'P1' | 'P2', clef: ResolvedStaffClef): string =>
    model.measures.map((m: TwoStaffMeasure, mIdx: number) => {
      const numAttr = m.isPickup ? 'number="0" implicit="yes"' : `number="${m.measureNumber}"`;
      let mXml = `    <measure ${numAttr}>\n`;
      if (mIdx === 0) {
        mXml += `      <attributes><divisions>12</divisions><key><fifths>${model.keySig.fifths}</fifths><mode>${model.keySig.mode}</mode></key><time><beats>${model.beatsPerMeasure}</beats><beat-type>${model.beatType}</beat-type></time><clef><sign>G</sign><line>2</line>${clef === 'treble_8vb' ? '<clef-octave-change>-1</clef-octave-change>' : ''}</clef></attributes>\n`;
        if (partId === 'P1') {
          mXml += `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${model.bpm}</per-minute></metronome></direction-type><sound tempo="${model.bpm}"/></direction>\n`;
          if (model.diapasonLabel) mXml += `      <direction placement="above"><direction-type><words>${escXml(model.diapasonLabel)}</words></direction-type></direction>\n`;
        }
      }
      if (partId === 'P1' && m.isBaquePause && m.pauseLabel) mXml += `      <direction placement="above"><direction-type><words>${escXml(m.pauseLabel)}</words></direction-type></direction>\n`;
      if (partId === 'P1' && m.isUnison) mXml += '      <direction placement="above"><direction-type><words>Unisson</words></direction-type></direction>\n';

      const figs = quantizeMeasureStepsToFigures(partId === 'P1' ? m.puxSteps : m.corSteps, m.beatsCount, model.keySig.fifths, clef, false);
      if (partId === 'P1' && m.chords.length > 0) {
        const chordsByBeat = new Map<number, string>(m.chords.map((c) => [c.beat - 1, c.symbol]));
        const emittedBeats = new Set<number>();
        for (const f of figs) {
          if (chordsByBeat.has(f.beatIndex) && !emittedBeats.has(f.beatIndex)) { mXml += renderHarmonyXml(chordsByBeat.get(f.beatIndex)!); emittedBeats.add(f.beatIndex); }
          mXml += renderFigureXml(f);
        }
      } else {
        for (const f of figs) mXml += renderFigureXml(f);
      }
      if (mIdx === model.measures.length - 1) mXml += '      <barline location="right"><bar-style>light-heavy</bar-style></barline>\n';
      return `${mXml}    </measure>\n`;
    }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escXml(model.title)}</work-title></work>
  <identification><creator type="software">O Girador — Cantador &amp; Organizador</creator></identification>
  <part-list>
    <part-group type="start" number="1"><group-symbol>bracket</group-symbol><group-barline>yes</group-barline></part-group>
    <score-part id="P1"><part-name>Puxador</part-name><part-abbreviation>Pux.</part-abbreviation></score-part>
    <score-part id="P2"><part-name>Coro</part-name><part-abbreviation>Cor.</part-abbreviation></score-part>
    <part-group type="stop" number="1"/>
  </part-list>
  <part id="P1">
${renderPartMeasures('P1', model.puxClef)}  </part>
  <part id="P2">
${renderPartMeasures('P2', model.corClef)}  </part>
</score-partwise>`;
}

export function triggerMusicXmlDownload(xmlContent: string, rawTitle = 'toada'): void {
  if (typeof document === 'undefined') return;
  const slug = String(rawTitle || 'toada').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'toada';
  const blob = new Blob([xmlContent], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${slug}.musicxml`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
