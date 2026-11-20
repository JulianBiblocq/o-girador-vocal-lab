/**
 * useTakeRecoveryController.ts
 * Contrôleur de `TakeRecoveryModal` : inspection lecture seule, lecteur d'aperçu audio propre (arrêt à la fermeture),
 * filtrage des lots d'orphelins et hydratation 100 % locale vers `ToadaProject` + IndexedDB (< 95 lignes).
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { inspectCloudTakesForProject } from '../../services/takeRecoveryService';
import { matchTakesToPatterns, isPackTitleMatching, expectedTakeDurationSec } from '../../utils/takeRecoveryMatcher';
import { hydratePatternWithRecoveryTake, applyHydratedPatternsToProject, exportProjectBackupJson } from '../../utils/patternTakeHydrator';
import { saveProjectToIndexedDB } from '../../utils/projectAutoSave';
import type { MatcherContext, RecoveryInventory, RecoveryTake } from '../../utils/takeRecoveryTypes';

export function useTakeRecoveryController(isOpen: boolean) {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const [inv, setInv] = useState<RecoveryInventory | null>(null);
  const [loading, setLoading] = useState(false), [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<'matched' | 'orphans'>('matched');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.src = ''; } catch { /* ignore */ } audioRef.current = null; }
    setPlayingKey(null);
  }, []);

  const matcherCtx = useMemo<MatcherContext>(() => ({
    patterns: project.patterns, bpm: project.bpm || 88, beatsPerMeasure: getBeatsPerMeasure(project.timeSignature),
    projectTitle: project.title, projectDocumentId: project.toadaMeta?.id,
  }), [project.patterns, project.bpm, project.timeSignature, project.title, project.toadaMeta?.id]);

  const refresh = useCallback(async () => {
    stopAudio(); setLoading(true);
    try {
      const res = await inspectCloudTakesForProject(project);
      setInv(res); setBatchFilter('ALL');
      const props = matchTakesToPatterns(matcherCtx, res);
      setTab(!props.some((p) => p.confidence === 'high') && res.orphanTakes.length > 0 ? 'orphans' : 'matched');
    } finally { setLoading(false); }
  }, [project, matcherCtx, stopAudio]);

  useEffect(() => { if (isOpen) void refresh(); else stopAudio(); return () => stopAudio(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const proposals = useMemo(() => (inv ? matchTakesToPatterns(matcherCtx, inv) : []), [matcherCtx, inv]);
  const highProposals = useMemo(() => proposals.filter((p) => p.confidence === 'high'), [proposals]);
  const titleMismatch = Boolean(inv?.pack && !isPackTitleMatching(inv.pack.title, inv.pack.documentId, matcherCtx));

  const batches = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const o of inv?.orphanTakes || []) map.set(o.batchKey, { label: o.batchLabel, count: (map.get(o.batchKey)?.count ?? 0) + 1 });
    return Array.from(map.entries());
  }, [inv]);

  const filteredOrphans = useMemo(
    () => (inv?.orphanTakes || []).filter((o) => batchFilter === 'ALL' || o.batchKey === batchFilter),
    [inv, batchFilter]
  );

  const handleTogglePlay = useCallback((url?: string, key?: string) => {
    if (!url || !key) return;
    if (playingKey === key) { stopAudio(); return; }
    stopAudio();
    const a = new Audio(url);
    a.onended = () => setPlayingKey(null); a.onerror = () => setPlayingKey(null);
    audioRef.current = a; setPlayingKey(key);
    void a.play().catch(() => setPlayingKey(null));
  }, [playingKey, stopAudio]);

  const applyItems = useCallback(async (items: Array<{ patternId: string; take: RecoveryTake }>) => {
    if (!items.length) return;
    stopAudio(); setApplying(true);
    try {
      const hydrated = new Map<string, typeof project.patterns[0]>();
      for (const it of items) {
        const pat = project.patterns.find((p) => p.id === it.patternId);
        if (pat) hydrated.set(pat.id, await hydratePatternWithRecoveryTake(project, pat, it.take));
      }
      if (hydrated.size > 0) {
        const next = applyHydratedPatternsToProject(project, hydrated);
        loadProject(next); await saveProjectToIndexedDB(next);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: t('recoveryAppliedToast', { count: hydrated.size }) } }));
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: String(err?.message || err) } }));
    } finally { setApplying(false); }
  }, [project, loadProject, stopAudio, t]);

  const bestPatternIdFor = useCallback((dur: number) =>
    [...project.patterns].sort((a, b) => Math.abs(expectedTakeDurationSec(a, matcherCtx) - dur) - Math.abs(expectedTakeDurationSec(b, matcherCtx) - dur))[0]?.id || '',
  [project.patterns, matcherCtx]);

  return {
    t, project, inv, loading, applying, tab, setTab, batchFilter, setBatchFilter, playingKey,
    matcherCtx, proposals, highProposals, titleMismatch, batches, filteredOrphans,
    refresh, handleTogglePlay, applyItems, bestPatternIdFor, handleBackupJson: () => exportProjectBackupJson(project),
  };
}
