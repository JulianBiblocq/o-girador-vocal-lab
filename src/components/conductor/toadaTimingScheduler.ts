/**
 * toadaTimingScheduler.ts
 * Horloge métrique dynamique et ordonnanceur temps-réel avec varispeed vocal (< 95 lignes).
 */
import type { ToadaArrangementSlot, VocalPatternItem } from '../../types/toadaProject.types';

export interface SlotMeasureLayout {
  slotIndex: number;
  startMeasure: number;
  advanceMeasures: number;
  measuresInSlot: number;
}

export function computeSlotsMeasureLayout(slots: ToadaArrangementSlot[], patterns: VocalPatternItem[]): SlotMeasureLayout[] {
  let currentMeasure = 1;
  return slots.map((slot, slotIndex) => {
    const pux = patterns.find((p) => p.id === slot.puxadorPatternId);
    const coro = patterns.find((p) => p.id === slot.coroPatternId);
    const measuresInSlot = Math.max(pux?.measuresCount ?? 1, coro?.measuresCount ?? 1, 1);
    const advanceMeasures = slot.advanceMeasures ?? measuresInSlot;
    const layout = { slotIndex, startMeasure: currentMeasure, advanceMeasures, measuresInSlot };
    currentMeasure += advanceMeasures;
    return layout;
  });
}

export class ToadaTimelineClock {
  private liveBpm: number = 88;
  private anchorMeasure: number = 1;
  private anchorTime: number = 0;
  private beatsPerMeasure: number = 4;

  public init(audioStartTime: number, initialBpm: number, beatsPerMeasure: number, initialMeasure = 1): void {
    this.anchorTime = audioStartTime;
    this.liveBpm = Math.max(30, Math.min(240, initialBpm || 88));
    this.beatsPerMeasure = beatsPerMeasure || 4;
    this.anchorMeasure = initialMeasure;
  }

  public getMeasureAtTime(time: number): number {
    const measureDuration = this.getMeasureDurationSec();
    return this.anchorMeasure + (time - this.anchorTime) / measureDuration;
  }

  public getTimeAtMeasure(measure: number): number {
    const measureDuration = this.getMeasureDurationSec();
    return this.anchorTime + (measure - this.anchorMeasure) * measureDuration;
  }

  public setLiveBpm(newBpm: number, currentTime: number): void {
    const clamped = Math.max(30, Math.min(240, newBpm));
    if (clamped === this.liveBpm) return;
    this.anchorMeasure = this.getMeasureAtTime(currentTime);
    this.anchorTime = currentTime;
    this.liveBpm = clamped;
  }

  public getLiveBpm(): number {
    return this.liveBpm;
  }

  public getMeasureDurationSec(): number {
    return this.beatsPerMeasure * (60 / this.liveBpm);
  }

  public getSpeedRatio(recordedBpm?: number): number {
    const base = recordedBpm && recordedBpm > 20 ? recordedBpm : this.liveBpm;
    return Math.max(0.2, Math.min(4.0, this.liveBpm / base));
  }
}
