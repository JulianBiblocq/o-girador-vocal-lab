/**
 * usePlayheadTracker.ts
 * Hook de suivi de tete de lecture haute precision (RAF) pour WaveformTrimEditor (< 35 lignes).
 */
import { useState, useEffect } from 'react';
import type { PreviewPlayer } from '../audio/PreviewPlayer';

export function usePlayheadTracker(
  player: PreviewPlayer,
  isPlaying: boolean,
  onPlaybackEnded: () => void
): number {
  const [playheadSec, setPlayheadSec] = useState<number>(-1);

  useEffect(() => {
    if (!isPlaying) {
      setPlayheadSec(-1);
      return;
    }
    let animId: number;
    const tick = () => {
      setPlayheadSec(player.getCurrentPlayheadSec());
      if (player.getIsPlaying()) {
        animId = requestAnimationFrame(tick);
      } else {
        onPlaybackEnded();
        setPlayheadSec(-1);
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, player, onPlaybackEnded]);

  return playheadSec;
}
