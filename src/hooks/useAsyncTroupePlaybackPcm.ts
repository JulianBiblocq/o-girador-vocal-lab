/**
 * useAsyncTroupePlaybackPcm.ts
 * Hook d'écoute transposée `troupeKey` non-bloquante via Web Worker DSP (Latest-Wins + cache WeakMap)
 * et abonnement léger au statut d'activité du Worker DSP (< 50 lignes).
 */
import { useState, useEffect } from 'react';
import { peekCachedTroupePCM, storeCachedTroupePCM } from '../audio/formantPreservingPitchShifter';
import { renderVoiceDspInWorker, subscribeVocalDspBusy, isVocalDspCancelled } from '../workers/vocalDspWorkerClient';

export function useAsyncTroupePlaybackPcm(
  patternId: string,
  activePCM: Float32Array,
  sampleRate: number,
  listenTarget: 'sung' | 'troupe',
  transpositionSemitones: number
): { playbackPCM: Float32Array; isDspBusy: boolean } {
  const [isDspBusy, setIsDspBusy] = useState(false);
  const [shiftedPCM, setShiftedPCM] = useState<Float32Array | null>(() =>
    peekCachedTroupePCM(activePCM, sampleRate, transpositionSemitones)
  );

  useEffect(() => subscribeVocalDspBusy((count) => setIsDspBusy(count > 0)), []);

  useEffect(() => {
    if (listenTarget !== 'troupe' || transpositionSemitones === 0 || !activePCM?.length) {
      setShiftedPCM(null);
      return;
    }
    const cached = peekCachedTroupePCM(activePCM, sampleRate, transpositionSemitones);
    if (cached) {
      setShiftedPCM(cached);
      return;
    }
    let cancelled = false;
    renderVoiceDspInWorker(
      { mode: 'formant_shift', pcm: activePCM, sampleRate, shiftSemitones: transpositionSemitones },
      { dedupeKey: `troupe_preview_${patternId}` }
    )
      .then((res) => {
        if (cancelled) return;
        storeCachedTroupePCM(activePCM, sampleRate, transpositionSemitones, res.processedPCM);
        setShiftedPCM(res.processedPCM);
      })
      .catch((err) => {
        if (!isVocalDspCancelled(err)) console.warn('[useAsyncTroupePlaybackPcm] Worker error:', err);
      });
    return () => { cancelled = true; };
  }, [patternId, activePCM, sampleRate, listenTarget, transpositionSemitones]);

  const playbackPCM =
    listenTarget === 'troupe' && transpositionSemitones !== 0
      ? (peekCachedTroupePCM(activePCM, sampleRate, transpositionSemitones) ?? shiftedPCM ?? activePCM)
      : activePCM;

  return { playbackPCM, isDspBusy };
}
