/**
 * exportTwinMutualizer.ts
 * Détection des groupes de patterns répétés dans `slots` ayant des prises audio distinctes,
 * sélection de la meilleure prise ou paire A+B anti-répétition, et mutualisation avant export (< 125 lignes).
 */
import { type ToadaProject, type VocalPatternItem, type VocalRole, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { normalizePatternLyricKey } from './twinPatternsHelper';
import { getPatternUsageCount, purgeUnusedPatternsFromProject } from './unusedPatternsPurger';
import { getBeatsPerMeasure } from './musicalMath';

export type ExportTwinChoice = 'single' | 'pair_ab' | 'keep';

export interface ExportTwinGroup {
  groupKey: string; role: VocalRole; lyricKey: string; displayLabel: string;
  patternIds: string[]; distinctAudioCount: number; slotOccurrencesCount: number;
  hasAdjacentRepeat: boolean; bestPatternId: string; secondBestPatternId: string;
  recommendedChoice: ExportTwinChoice;
}

export function getEffectivePatternPcm(pat: VocalPatternItem): { pcm: Float32Array | null; sampleRate: number } {
  const masterVar = pat.variants?.norm_norm || pat.variants?.[pat.activeVariantKey];
  const rec = pat.recordingResult ?? masterVar?.recordingResult;
  const pcm = pat.correctedAudioSamples?.length ? pat.correctedAudioSamples : (rec?.pcm ?? pat.rawAudioSamples ?? null);
  return { pcm: pcm && pcm.length > 0 ? pcm : null, sampleRate: rec?.sampleRate || pat.pack?.audio?.sampleRate || 44100 };
}

export function computePatternAudioSignature(pat: VocalPatternItem): string {
  const { pcm } = getEffectivePatternPcm(pat);
  const trimKey = `${(pat.trimStartSec ?? 0).toFixed(4)}_${(pat.trimEndSec ?? 0).toFixed(4)}_${(pat.t1OffsetSec ?? 0).toFixed(4)}`;
  if (!pcm) return pat.audioUrl ? `url:${pat.audioUrl}:${trimKey}` : '';
  const u32 = new Uint32Array(pcm.buffer, pcm.byteOffset, pcm.length);
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(u32.length / 4096));
  for (let i = 0; i < u32.length; i += step) hash = Math.imul(hash ^ u32[i], 0x01000193) >>> 0;
  return `pcm:${pcm.length}:${trimKey}:${hash.toString(16)}`;
}

export function scoreBestVocalTake(pat: VocalPatternItem, projectBpm: number, beatsPerMeasure = 4): number {
  const { pcm, sampleRate } = getEffectivePatternPcm(pat);
  if (!pcm) return pat.audioUrl ? 10 : -1000;
  const startIdx = Math.max(0, Math.floor((pat.trimStartSec || 0) * sampleRate));
  const rawEnd = pat.trimEndSec && pat.trimEndSec > (pat.trimStartSec || 0) ? Math.ceil(pat.trimEndSec * sampleRate) : pcm.length;
  const endIdx = Math.min(pcm.length, Math.max(startIdx + 1, rawEnd));
  let sumSq = 0, peak = 0;
  for (let i = startIdx; i < endIdx; i++) { const v = Math.abs(pcm[i]); if (v > peak) peak = v; sumSq += v * v; }
  const rms = Math.sqrt(sumSq / (endIdx - startIdx)), durSec = (endIdx - startIdx) / sampleRate;
  const recBpm = Number((pat as any).recordedBpm || pat.recordingResult?.recordedBpm || pat.baseBpm || pat.bpm || projectBpm);
  const expectedSec = ((pat.measuresCount || 1) * beatsPerMeasure + (pat.hasTailBeat ? 1 : 0)) * (60 / Math.max(30, recBpm));
  const relErr = expectedSec > 0 ? Math.min(1, Math.abs(durSec - expectedSec) / expectedSec) : 0;
  let score = 50 + (1 - relErr) * 20;
  if (rms < 0.008) score -= 45; else if (rms >= 0.03 && rms <= 0.4) score += 25;
  if (peak >= 0.995) score -= 25;
  if (pat.isNotesValidated || pat.stepStatus?.notesValidated || pat.stepStatus?.trimmed) score += 10;
  return Number(score.toFixed(3));
}

export function detectExportTwinGroups(project: ToadaProject): ExportTwinGroup[] {
  const bpm = Number(project.bpm || DEFAULT_TOADA_BPM), beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const buckets = new Map<string, VocalPatternItem[]>();
  for (const pat of (project.patterns || []).filter((p) => getPatternUsageCount(project, p.id) > 0)) {
    const lyricKey = normalizePatternLyricKey(pat);
    if (!lyricKey) continue;
    const gKey = `${pat.role}::${lyricKey}`;
    buckets.set(gKey, [...(buckets.get(gKey) || []), pat]);
  }

  const groups: ExportTwinGroup[] = [];
  for (const [groupKey, pats] of buckets.entries()) {
    if (pats.length < 2) continue;
    const sigById = new Map(pats.map((p) => [p.id, computePatternAudioSignature(p)]));
    const nonEmptySigs = new Set([...sigById.values()].filter(Boolean));
    if (nonEmptySigs.size < 2) continue;
    const role = pats[0].role, roleField = role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
    const idSet = new Set(pats.map((p) => p.id));
    let slotOccurrencesCount = 0, hasAdjacentRepeat = false, prevMatched = false;
    for (const slot of project.slots || []) {
      if (!slot.puxadorPatternId && !slot.coroPatternId) { prevMatched = false; continue; }
      const matched = Boolean(slot[roleField] && idSet.has(slot[roleField]!));
      if (matched) { slotOccurrencesCount++; if (prevMatched) hasAdjacentRepeat = true; }
      prevMatched = matched;
    }
    const ranked = [...pats].sort((a, b) => scoreBestVocalTake(b, bpm, beatsPerMeasure) - scoreBestVocalTake(a, bpm, beatsPerMeasure));
    const best = ranked[0], bestSig = sigById.get(best.id);
    const second = ranked.find((p) => p.id !== best.id && sigById.get(p.id) !== bestSig) ?? ranked[1] ?? best;
    const rawLabel = (best.assignedLyricsText || best.name || groupKey).replace(/\[\d+\]|<u>|<\/u>|\*/g, '').trim();
    groups.push({
      groupKey, role, lyricKey: groupKey.split('::')[1], displayLabel: rawLabel.slice(0, 44),
      patternIds: pats.map((p) => p.id), distinctAudioCount: nonEmptySigs.size, slotOccurrencesCount,
      hasAdjacentRepeat, bestPatternId: best.id, secondBestPatternId: second.id,
      recommendedChoice: hasAdjacentRepeat ? 'pair_ab' : 'single',
    });
  }
  return groups;
}

export function applyExportTwinMutualization(
  project: ToadaProject, choices: Record<string, ExportTwinChoice>, options?: { purgeLocalUnused?: boolean }
): ToadaProject {
  let nextSlots = [...(project.slots || [])];
  for (const g of detectExportTwinGroups(project)) {
    const choice = choices[g.groupKey] ?? g.recommendedChoice;
    if (choice === 'keep') continue;
    const idSet = new Set(g.patternIds), roleField = g.role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
    let occ = 0;
    nextSlots = nextSlots.map((s) => {
      const cur = s[roleField];
      if (!cur || !idSet.has(cur)) return s;
      const targetId = choice === 'single' ? g.bestPatternId : (occ % 2 === 0 ? g.bestPatternId : g.secondBestPatternId);
      occ++;
      return { ...s, [roleField]: targetId };
    });
  }
  const updated: ToadaProject = { ...project, slots: nextSlots };
  return options?.purgeLocalUnused ? purgeUnusedPatternsFromProject(updated).updatedProject : updated;
}
