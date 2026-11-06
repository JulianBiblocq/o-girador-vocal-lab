/**
 * conductorRoleTimelineBuilder.ts
 * Construction de la timeline mesure par mesure d'un rôle (Puxador ou Coro) à partir de project.slots,
 * avec détection explicite des Trous de Rôle (isRoleGap, gapMeasures) et des fenêtres de coupe (< 135 lignes).
 */
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { NO_ANACRUSIS_PRE_MARGIN_SEC } from './anacrusisTimingHelper';
import { computeSlotsMeasureLayout } from '../components/conductor/toadaTimingScheduler';
import { CONTINUOUS_LEAD_IN_MEASURES } from '../audio/continuousCueHelper';

export interface RoleTimelineItem {
  slotIndex: number;
  startMeasure: number;
  measuresCount: number;
  isRoleGap: boolean;
  gapMeasures: number;
  patternId: string | null;
  patternName?: string;
  lyrics?: string;
  counterRolePatternId?: string | null;
  counterRoleName?: string;
  counterRoleLyrics?: string;
  hasAnacrusis: boolean;
  anacrusisBeats: number;
  metricT1Sec: number;
  windowStartSec: number;
  windowEndSec: number;
  nextEntryMeasure?: number;
  nextEntrySlotIndex?: number;
  nextEntryLyrics?: string;
  nextEntryHasAnacrusis?: boolean;
}

export function buildConductorRoleTimeline(
  project: ToadaProject,
  targetRole: VocalRole,
  preM0MarginSec = 0,
  leadInMeasures = CONTINUOUS_LEAD_IN_MEASURES
): RoleTimelineItem[] {
  const bpm = project.bpm || 88;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / bpm;
  const measureDuration = beatsPerMeasure * beatDuration;
  const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);

  const rawItems: RoleTimelineItem[] = layouts.map((layout) => {
    const slot = project.slots[layout.slotIndex];
    const patId = targetRole === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId;
    const counterPatId = targetRole === 'puxador' ? slot.coroPatternId : slot.puxadorPatternId;
    const pat = patId ? project.patterns.find((p) => p.id === patId) : undefined;
    const counterPat = counterPatId ? project.patterns.find((p) => p.id === counterPatId) : undefined;

    const slotMeasureFromM0 = (leadInMeasures - 1) + layout.startMeasure;
    const metricT1Sec = preM0MarginSec + slotMeasureFromM0 * measureDuration;
    const measuresCount = pat?.measuresCount ?? layout.advanceMeasures;
    const hasAnacrusis = pat ? pat.hasAnacrusis !== false : false;
    const anacrusisBeats = pat?.anacrusisBeats ?? (hasAnacrusis ? 2 : 0);
    const anacSec = hasAnacrusis ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;

    if (!patId) {
      return {
        slotIndex: layout.slotIndex,
        startMeasure: layout.startMeasure,
        measuresCount: layout.advanceMeasures,
        isRoleGap: true,
        gapMeasures: layout.advanceMeasures,
        patternId: null,
        counterRolePatternId: counterPatId,
        counterRoleName: counterPat?.name,
        counterRoleLyrics: counterPat?.assignedLyricsText || counterPat?.name || '',
        hasAnacrusis: false,
        anacrusisBeats: 0,
        metricT1Sec,
        windowStartSec: metricT1Sec,
        windowEndSec: metricT1Sec + layout.advanceMeasures * measureDuration,
      };
    }

    return {
      slotIndex: layout.slotIndex,
      startMeasure: layout.startMeasure,
      measuresCount,
      isRoleGap: false,
      gapMeasures: 0,
      patternId: patId,
      patternName: pat?.name,
      lyrics: pat?.assignedLyricsText || pat?.name || '',
      counterRolePatternId: counterPatId,
      counterRoleName: counterPat?.name,
      counterRoleLyrics: counterPat?.assignedLyricsText || counterPat?.name || '',
      hasAnacrusis,
      anacrusisBeats,
      metricT1Sec,
      windowStartSec: Math.max(0, metricT1Sec - anacSec),
      windowEndSec: metricT1Sec + measuresCount * measureDuration + beatDuration,
    };
  });

  // Enrichir chaque créneau (notamment les trous) avec la durée totale du trou consécutif et la prochaine entrée du rôle
  for (let i = 0; i < rawItems.length; i++) {
    const nextSung = rawItems.slice(i + 1).find((it) => !it.isRoleGap);
    if (nextSung) {
      rawItems[i].nextEntryMeasure = nextSung.startMeasure;
      rawItems[i].nextEntrySlotIndex = nextSung.slotIndex + 1;
      rawItems[i].nextEntryLyrics = nextSung.lyrics;
      rawItems[i].nextEntryHasAnacrusis = nextSung.hasAnacrusis;
    }
    if (rawItems[i].isRoleGap) {
      let totalGapM = 0;
      for (let j = i; j < rawItems.length && rawItems[j].isRoleGap; j++) {
        totalGapM += rawItems[j].measuresCount;
      }
      rawItems[i].gapMeasures = totalGapM;
    }
  }

  return rawItems;
}
