/**
 * usePlayheadTracker.ts
 * Hook de suivi de tête de lecture sans Render Thrashing (0 setState en boucle RAF) (< 40 lignes).
 */
import { useEffect, useCallback } from 'react';
import type { PreviewPlayer } from '../audio/PreviewPlayer';

export function usePlayheadTracker(
  player: PreviewPlayer,
  isPlaying: boolean,
  onPlaybackEnded: () => void
): () => number {
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    const tick = () => {
      if (player.getIsPlaying()) {
        animId = requestAnimationFrame(tick);
      } else {
        onPlaybackEnded();
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, player, onPlaybackEnded]);

  return useCallback(
    () => (isPlaying && player.getIsPlaying() ? player.getCurrentPlayheadSec() : -1),
    [isPlaying, player]
  );
}
