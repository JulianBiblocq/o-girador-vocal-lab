/**
 * patternTakeMatcher.ts
 * Appariement non destructif lors d'une resynchronisation Organizador : réserve d'abord les paires exactes
 * `(cardIndex, role)`, apparie par clé normalisée, réutilise proprement les strophes répétées et préserve
 * `audioUrl` / `t1OffsetSec` / `trim` même lorsque le PCM n'est pas encore décodé en mémoire (< 95 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { buildNormalizedPatternKey } from './timeAnchorParser';
import { normalizeLyricsForComparison } from './sheetSlotBuilder';

function hasTakeOrUrl(p: VocalPatternItem): boolean {
  return Boolean(p.recordingResult?.pcm?.length || p.rawAudioSamples?.length || (p as any).audioUrl);
}

export function buildSyncedPatternMatchMap(
  newPatterns: VocalPatternItem[],
  existingPatterns: VocalPatternItem[]
): Map<string, VocalPatternItem> {
  const result = new Map<string, VocalPatternItem>();
  const usedIds = new Set<string>();
  const sameLen = existingPatterns.length === newPatterns.length;
  const effCard = (p: VocalPatternItem, idx: number) => p.cardIndex ?? (sameLen ? idx : undefined);

  // Passe 1 : réservation stricte par (id + rôle) puis (cardIndex explicite + rôle)
  for (let i = 0; i < newPatterns.length; i++) {
    const np = newPatterns[i], targetCard = np.cardIndex ?? i;
    const byId = existingPatterns.find((ep) => !usedIds.has(ep.id) && ep.id === np.id && ep.role === np.role);
    const byCard = byId ?? existingPatterns.find((ep, eIdx) => !usedIds.has(ep.id) && effCard(ep, eIdx) === targetCard && ep.role === np.role);
    if (byCard) { result.set(np.id, byCard); usedIds.add(byCard.id); }
  }

  // Passe 2 : clé normalisée libre -> nom libre -> réutilisation d'une strophe identique avec audio -> carte libre
  for (let i = 0; i < newPatterns.length; i++) {
    const np = newPatterns[i];
    if (result.has(np.id)) continue;
    const targetCard = np.cardIndex ?? i;
    const targetKey = buildNormalizedPatternKey(np.role, np.assignedLyricsText || '', np.timeAnchors);
    const normLyrics = normalizeLyricsForComparison(np.assignedLyricsText || '');

    const byNormFree = existingPatterns.find((ep) => !usedIds.has(ep.id) && buildNormalizedPatternKey(ep.role, ep.assignedLyricsText || '', ep.timeAnchors) === targetKey);
    const byLyricsFree = byNormFree ?? (normLyrics ? existingPatterns.find((ep) => !usedIds.has(ep.id) && ep.role === np.role && normalizeLyricsForComparison(ep.assignedLyricsText || '') === normLyrics) : undefined);
    const byNameFree = byLyricsFree ?? existingPatterns.find((ep) => !usedIds.has(ep.id) && ep.role === np.role && ep.name === np.name);
    if (byNameFree) { result.set(np.id, byNameFree); usedIds.add(byNameFree.id); continue; }

    const repeatedTwin = normLyrics
      ? existingPatterns.find((ep) => hasTakeOrUrl(ep) && ep.role === np.role && normalizeLyricsForComparison(ep.assignedLyricsText || '') === normLyrics)
      : undefined;
    if (repeatedTwin) { result.set(np.id, repeatedTwin); continue; }

    const byCardAnyRole = existingPatterns.find((ep, eIdx) => !usedIds.has(ep.id) && effCard(ep, eIdx) === targetCard);
    if (byCardAnyRole) { result.set(np.id, byCardAnyRole); usedIds.add(byCardAnyRole.id); }
  }
  return result;
}

export function mergeCloudOnlyMatchedPattern(newPat: VocalPatternItem, matched: VocalPatternItem, targetBpm: number): VocalPatternItem {
  const audioUrl = (matched as any).audioUrl as string | undefined;
  const sameLyrics = normalizeLyricsForComparison(newPat.assignedLyricsText || '') === normalizeLyricsForComparison(matched.assignedLyricsText || '');
  const keepSteps = sameLyrics && (matched.mainSteps?.length ?? 0) > 0;
  return {
    ...newPat,
    baseBpm: targetBpm,
    bpm: targetBpm,
    referencePitch: matched.referencePitch || newPat.referencePitch,
    tessitura: matched.tessitura ?? newPat.tessitura,
    referenceMidiNotes: sameLyrics ? (matched.referenceMidiNotes ?? newPat.referenceMidiNotes) : newPat.referenceMidiNotes,
    ...(audioUrl ? {
      audioUrl,
      trimStartSec: matched.trimStartSec ?? 0,
      trimEndSec: matched.trimEndSec ?? 0,
      t1OffsetSec: matched.t1OffsetSec ?? 0,
      lowCutEnabled: matched.lowCutEnabled ?? true,
      enableTonePolish: matched.enableTonePolish ?? true,
    } : {}),
    ...(keepSteps ? {
      anacrusisSteps: matched.anacrusisSteps,
      mainSteps: matched.mainSteps,
      isMidiInitialized: matched.isMidiInitialized,
      midiLocked: matched.midiLocked,
    } : {}),
  } as VocalPatternItem;
}
