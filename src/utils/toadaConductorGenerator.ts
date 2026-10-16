/**
 * toadaConductorGenerator.ts
 * Génération automatique des patterns, déduplication et frise conducteur (< 65 lignes).
 */
import type { ToadaProject, VocalPatternItem, ToadaArrangementSlot } from '../types/toadaProject.types';
import type { ParsedToadaSheetResult, ParsedLyricsSegment } from '../types/toadaDocument.types';
import { createDefaultVocalPattern } from '../types/toadaProject.types';
import { createMirroredPattern } from './patternMirrorHelper';

export function generateToadaFromSheet(project: ToadaProject, parsed: ParsedToadaSheetResult): ToadaProject {
  const newPatterns: VocalPatternItem[] = [];
  const newSlots: ToadaArrangementSlot[] = [];
  const map = new Map<string, string>();
  let prevSeg: ParsedLyricsSegment | null = null;

  for (let i = 0; i < parsed.segments.length; i++) {
    const seg = parsed.segments[i];
    const key = `${seg.role}:${seg.text.toLowerCase().trim()}`;
    let patId = map.get(key);

    if (!patId) {
      const isMirror = seg.role === 'coro' && prevSeg?.role === 'puxador' && prevSeg.text.toLowerCase().trim() === seg.text.toLowerCase().trim();
      const prevPat = isMirror && prevSeg ? newPatterns.find((p) => p.assignedLyricsText === prevSeg?.text && p.role === 'puxador') : null;

      const pat = prevPat
        ? createMirroredPattern(prevPat, 'coro')
        : createDefaultVocalPattern(
            seg.role,
            `${seg.role === 'puxador' ? 'Appel' : 'Choeur'} ${newPatterns.length + 1}`,
            2,
            parsed.docMeta?.bpmDefaut ?? project.bpm
          );
      pat.assignedLyricsText = seg.text;
      pat.assignedPhoneticText = seg.phoneticText;
      newPatterns.push(pat);
      patId = pat.id;
      map.set(key, patId);
    }

    newSlots.push({
      slotId: `slot-${newSlots.length + 1}`,
      puxadorPatternId: seg.role === 'puxador' ? patId : null,
      coroPatternId: seg.role === 'coro' ? patId : null,
    });
    prevSeg = seg;
  }

  return {
    ...project,
    title: parsed.docMeta?.titre || project.title,
    bpm: parsed.docMeta?.bpmDefaut ?? project.bpm,
    patterns: newPatterns.length > 0 ? newPatterns : project.patterns,
    slots: newSlots.length > 0 ? newSlots : project.slots,
    activePatternId: newPatterns[0]?.id || project.activePatternId,
    toadaMeta: parsed.docMeta ? { ...project.toadaMeta, ...parsed.docMeta } : project.toadaMeta,
  };
}
