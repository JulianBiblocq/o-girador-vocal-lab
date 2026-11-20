/**
 * takeRecoveryMatcher.ts
 * Appariement pur prises Cloud ➔ patterns du chant ouvert, SANS jamais se fier à un index : priorité
 * `patternId` ➔ rôle + paroles normalisées + cardIndex ➔ rôle + paroles (réutilisation autorisée pour strophes répétées)
 * ➔ durée (suggestion seulement). Garde-fou : un pack dont le titre ne correspond pas au chant ouvert n'est JAMAIS `high` (< 140 lignes).
 */
import { normalizeSongTitle } from './varalSongFilter';
import { normalizeLyricsForComparison } from './sheetSlotBuilder';
import type {
  MatcherContext, MatcherPattern, RecoveryInventory, RecoveryProposal, RecoveryReason, RecoveryTake, RecoveryWarning, TimingChecks,
} from './takeRecoveryTypes';

const DURATION_OK_PCT = 12, DURATION_FAR_PCT = 30, T1_MAX_SEC = 0.25, T1_SNAP_SEC = 0.01;

export function isPackTitleMatching(packTitle: string | undefined, packDocId: string | undefined, ctx: MatcherContext): boolean {
  const a = normalizeSongTitle(packTitle), b = normalizeSongTitle(ctx.projectTitle);
  if (a && b && a === b) return true;
  return Boolean(packDocId && ctx.projectDocumentId && packDocId === ctx.projectDocumentId);
}

export function expectedTakeDurationSec(p: MatcherPattern, ctx: MatcherContext, takeBpm?: number): number {
  const bpm = Math.max(30, takeBpm || ctx.bpm || 88);
  const tail = p.hasTailBeat || p.exitBeat === 1 ? 1 : 0, pickup = p.hasAnacrusis ? (p.anacrusisBeats ?? 2) : 0;
  return ((p.measuresCount || 1) * ctx.beatsPerMeasure + tail + pickup) * (60 / bpm);
}

export function computeTimingChecks(p: MatcherPattern, take: RecoveryTake, ctx: MatcherContext): TimingChecks {
  const expectedSec = expectedTakeDurationSec(p, ctx, take.recordedBpm);
  const deltaPct = expectedSec > 0 ? ((take.durationSec - expectedSec) / expectedSec) * 100 : 0;
  const t1 = take.t1OffsetSec ?? 0;
  return { expectedSec, deltaPct, normalizedT1: Math.abs(t1) < T1_SNAP_SEC ? 0 : t1, trimStartSec: take.trimStartSec ?? 0 };
}

function buildProposal(p: MatcherPattern, take: RecoveryTake, reason: RecoveryReason, ctx: MatcherContext, packTrusted: boolean, reused: boolean): RecoveryProposal {
  const checks = computeTimingChecks(p, take, ctx), warnings: RecoveryWarning[] = [];
  if (!packTrusted && take.source === 'pack') warnings.push('title-mismatch');
  if ((take.transpositionSemitones ?? 0) !== 0) warnings.push('transposed');
  const abs = Math.abs(checks.deltaPct);
  if (abs > DURATION_FAR_PCT) warnings.push('duration-far'); else if (abs > DURATION_OK_PCT) warnings.push('duration-off');
  if (Math.abs(checks.normalizedT1) > T1_MAX_SEC) warnings.push('t1-off');
  if (checks.trimStartSec > T1_SNAP_SEC) warnings.push('trim-start');
  if (reused) warnings.push('reused');
  const blocking = warnings.some((w) => w === 'title-mismatch' || w === 'transposed' || w === 'duration-far');
  return { patternId: p.id, take, reason, warnings, checks, confidence: reason === 'duration' || blocking ? 'suggest' : 'high' };
}

export function matchTakesToPatterns(ctx: MatcherContext, inv: RecoveryInventory): RecoveryProposal[] {
  const packTrusted = inv.pack ? isPackTitleMatching(inv.pack.title, inv.pack.documentId, ctx) : false;
  const takes = inv.packTakes, used = new Map<string, number>(), out = new Map<string, RecoveryProposal>();
  const lyricsKey = (s?: string) => normalizeLyricsForComparison(s || '');
  const take = (p: MatcherPattern, t: RecoveryTake, reason: RecoveryReason, reused: boolean) => {
    used.set(t.key, (used.get(t.key) ?? 0) + 1); out.set(p.id, buildProposal(p, t, reason, ctx, packTrusted, reused));
  };

  for (const p of ctx.patterns) {
    const t = takes.find((c) => c.patternId === p.id && (!c.role || c.role === p.role) && !used.has(c.key));
    if (t) take(p, t, 'patternId', false);
  }
  for (const p of ctx.patterns) {
    if (out.has(p.id) || p.cardIndex === undefined) continue;
    const k = lyricsKey(p.assignedLyricsText);
    const exact = k ? takes.find((c) => c.role === p.role && c.cardIndex === p.cardIndex && lyricsKey(c.lyrics) === k && !used.has(c.key)) : undefined;
    if (exact) take(p, exact, 'role+lyrics+card', false);
  }
  for (const p of ctx.patterns) {
    if (out.has(p.id)) continue;
    const k = lyricsKey(p.assignedLyricsText);
    if (!k) continue;
    const same = takes.filter((c) => c.role === p.role && lyricsKey(c.lyrics) === k);
    const free = same.filter((c) => !used.has(c.key));
    if (free[0]) take(p, free[0], 'role+lyrics', false);
    else if (same.length) take(p, [...same].sort((a, b) => (used.get(a.key) ?? 0) - (used.get(b.key) ?? 0))[0], 'role+lyrics(repeat)', true);
  }
  for (const p of ctx.patterns) {
    if (out.has(p.id)) continue;
    const ranked = rankTakesForPattern(p, takes.filter((c) => c.role === p.role && !used.has(c.key)), ctx)[0];
    if (ranked && Math.abs(ranked.deltaPct) <= DURATION_OK_PCT) take(p, ranked.take, 'duration', false);
  }
  return ctx.patterns.map((p) => out.get(p.id)).filter((x): x is RecoveryProposal => Boolean(x));
}

/** Classe des prises (pack ou orphelines) par proximité de durée avec le pattern : aide à l'association manuelle. */
export function rankTakesForPattern(p: MatcherPattern, candidates: RecoveryTake[], ctx: MatcherContext): Array<{ take: RecoveryTake; deltaPct: number }> {
  return candidates
    .map((take) => ({ take, deltaPct: computeTimingChecks(p, take, ctx).deltaPct }))
    .sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
}
