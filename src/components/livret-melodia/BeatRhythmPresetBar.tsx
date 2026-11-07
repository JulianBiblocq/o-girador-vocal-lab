/**
 * BeatRhythmPresetBar.tsx
 * Barre épinglée (Docked Footer) des figures rythmiques Maracatu (binaires + triolets ³1-2-3 et ³_2-3)
 * en 1 clic sous chaque temps du Piano Roll (< 135 lignes).
 */
import React from 'react';
import type { VocalStepData, PitchCurvePoint } from '../../types/vocalPack.types';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { reanalyzeNotesOnAlignedSyllables } from '../../audio/syllableGuidedPitchReanalyzer';
import { isBeatTriplet } from '../../utils/tripletBeatHelper';
import { midiToNoteName } from '../../utils/noteUtils';
import { useLanguage } from '../../i18n/LanguageContext';

export interface BeatRhythmPreset {
  id: string; label: string; subdivs: number[]; isTriplet?: boolean; titleFr: string; titleBr: string;
}

export const MARACATU_BEAT_PRESETS: BeatRhythmPreset[] = [
  { id: '1---', label: '1───', subdivs: [0], titleFr: 'Temps plein tenu (Noire)', titleBr: 'Tempo inteiro sustentado (Semínima)' },
  { id: '1-3', label: '1-3', subdivs: [0, 2], titleFr: 'Temps + Contretemps (2 croches)', titleBr: 'Tempo + Contratempo (2 colcheias)' },
  { id: '2-4', label: '2-4', subdivs: [1, 3], titleFr: 'Syncopes Maracatu (2e et 4e doubles)', titleBr: 'Síncopes Maracatu (2ª e 4ª semicolcheias)' },
  { id: '1-2-4', label: '1-2-4', subdivs: [0, 1, 3], titleFr: 'Figure Maracatu 3 coups (1 - 2 - 4)', titleBr: 'Figura Maracatu 3 toques (1 - 2 - 4)' },
  { id: '_2-3-4', label: '_2-3-4', subdivs: [1, 2, 3], titleFr: 'Soupir sur le temps + 3 doubles (_ 2 - 3 - 4)', titleBr: 'Pausa na cabeça + 3 semicolcheias (_ 2 - 3 - 4)' },
  { id: '1-2-3-4', label: '1-2-3-4', subdivs: [0, 1, 2, 3], titleFr: '4 doubles-croches (1 - 2 - 3 - 4)', titleBr: '4 semicolcheias (1 - 2 - 3 - 4)' },
  { id: '3:1-2-3', label: '³1-2-3', subdivs: [0, 1, 2], isTriplet: true, titleFr: 'Triolet plein : 3 notes égales sur les 3 tiers (● ● ●)', titleBr: 'Tercina cheia : 3 notas iguais nos 3 terços (● ● ●)' },
  { id: '3:_2-3', label: '³_2-3', subdivs: [1, 2], isTriplet: true, titleFr: 'Soupir de triolet sur le 1er tiers + notes sur les 2e et 3e tiers (○ ● ●)', titleBr: 'Pausa de tercina no 1º terço + notas no 2º e 3º terços (○ ● ●)' },
];

export function applyBeatRhythmPreset(
  allSteps: VocalStepData[], beatIndex: number, presetSubdivsOrId: number[] | string, resPerBeat = 4, isTriplet = false
): VocalStepData[] {
  const found = typeof presetSubdivsOrId === 'string'
    ? MARACATU_BEAT_PRESETS.find((p) => p.id === presetSubdivsOrId || p.label === presetSubdivsOrId)
    : undefined;
  const presetSubdivs = typeof presetSubdivsOrId === 'string' ? (found ? found.subdivs : [0]) : presetSubdivsOrId;
  const tripletMode = typeof presetSubdivsOrId === 'string' ? Boolean(found?.isTriplet) : isTriplet;

  const bStart = beatIndex * resPerBeat, bEnd = Math.min(allSteps.length, bStart + resPerBeat);
  if (bStart < 0 || bStart >= allSteps.length || presetSubdivs.length === 0) return allSteps;

  const next = allSteps.map((s) => ({ ...s }));
  const syls: string[] = [], midis: number[] = [];
  let fallbackMidi = allSteps.find((s) => s.active && s.midiNumber > 0)?.midiNumber ?? 60;
  for (let i = bStart; i < bEnd; i++) {
    const st = allSteps[i];
    if (st.active && st.midiNumber > 0) fallbackMidi = st.midiNumber;
    if (st.active && st.note !== '───' && st.tripletSlot !== 'unused') {
      if (st.syllable?.trim()) syls.push(st.syllable.trim());
      if (st.midiNumber > 0) midis.push(st.midiNumber);
    }
  }

  const targetCount = presetSubdivs.length, assignedSyls: string[] = new Array(targetCount).fill('');
  if (syls.length <= targetCount) {
    for (let k = 0; k < syls.length; k++) assignedSyls[k] = syls[k];
  } else {
    for (let k = 0; k < targetCount - 1; k++) assignedSyls[k] = syls[k];
    assignedSyls[targetCount - 1] = syls.slice(targetCount - 1).join('');
  }

  const onsetSet = new Map<number, number>(presetSubdivs.map((sub, idx) => [sub, idx]));
  let curMidi = midis[0] || fallbackMidi, seenFirstOnset = false;

  for (let s = 0; s < bEnd - bStart; s++) {
    const idx = bStart + s, base = next[idx];
    if (tripletMode && s === 3) {
      next[idx] = { ...base, tripletSlot: 'unused', active: false, isTie: false, midiNumber: 0, note: 'C4', syllable: '' };
      continue;
    }
    const slotTag = tripletMode ? ((s + 1) as 1 | 2 | 3) : undefined;
    if (onsetSet.has(s)) {
      const k = onsetSet.get(s)!;
      curMidi = midis[Math.min(k, Math.max(0, midis.length - 1))] || fallbackMidi;
      seenFirstOnset = true;
      next[idx] = { ...base, tripletSlot: slotTag, active: true, isTie: false, midiNumber: curMidi, note: midiToNoteName(curMidi), syllable: assignedSyls[k] || '' };
    } else if (seenFirstOnset) {
      next[idx] = { ...base, tripletSlot: slotTag, active: true, isTie: true, midiNumber: curMidi, note: '───', syllable: '' };
    } else {
      next[idx] = { ...base, tripletSlot: slotTag, active: false, isTie: false, midiNumber: 0, note: 'C4', syllable: '' };
    }
  }
  return next;
}

interface BeatRhythmPresetBarProps {
  allSteps: VocalStepData[]; gridWidth: number; resPerBeat?: number; readOnly?: boolean;
  pitchCurve?: PitchCurvePoint[]; gridStartSec?: number; stepDurationSec?: number;
  tonic?: string; scaleType?: ScaleType; allowedPitchClasses?: Set<number> | null;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
}

export const BeatRhythmPresetBar: React.FC<BeatRhythmPresetBarProps> = ({
  allSteps, gridWidth, resPerBeat = 4, readOnly = false,
  pitchCurve, gridStartSec = 0, stepDurationSec = 0.17, tonic = 'C', scaleType = 'chromatic', allowedPitchClasses,
  onUpdateSteps,
}) => {
  const { language } = useLanguage();
  if (readOnly || allSteps.length === 0) return null;
  const totalBeats = Math.floor(allSteps.length / resPerBeat), beatWidth = gridWidth / Math.max(1, totalBeats);

  return (
    <div className="flex items-center border-t border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] py-0.5 select-none" style={{ width: `${64 + gridWidth}px`, height: '26px' }}>
      <div className="sticky left-0 z-20 shrink-0 w-[64px] h-full bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex items-center justify-center">
        <span className="text-[7.5px] font-mono font-bold text-[var(--cordel-secondary-text)] tracking-wider uppercase">{language === 'br' ? 'RITMO' : 'RYTHME'}</span>
      </div>
      <div className="flex items-center h-full" style={{ width: `${gridWidth}px` }}>
        {Array.from({ length: totalBeats }, (_, bIdx) => {
          const bStart = bIdx * resPerBeat, beatIsTriplet = isBeatTriplet(allSteps, bStart), activeSubdivs: number[] = [];
          for (let s = 0; s < (beatIsTriplet ? 3 : resPerBeat) && bStart + s < allSteps.length; s++) {
            const st = allSteps[bStart + s];
            if (st.active && st.note !== '───' && st.tripletSlot !== 'unused') activeSubdivs.push(s);
          }
          const sig = activeSubdivs.join('-');
          return (
            <div key={bIdx} style={{ width: `${beatWidth}px` }} className="flex items-center justify-center gap-0.5 px-0.5 border-r border-[var(--cordel-border-sub)] overflow-hidden h-full">
              {MARACATU_BEAT_PRESETS.map((preset) => {
                const isMatch = Boolean(preset.isTriplet) === beatIsTriplet && preset.subdivs.join('-') === sig;
                return (
                  <button
                    key={preset.id} type="button" title={`T${bIdx + 1} : ${language === 'br' ? preset.titleBr : preset.titleFr}`}
                    onClick={() => {
                      const rhythmUpdated = applyBeatRhythmPreset(allSteps, bIdx, preset.subdivs, resPerBeat, Boolean(preset.isTriplet));
                      const reanalyzed = pitchCurve && pitchCurve.length > 0
                        ? reanalyzeNotesOnAlignedSyllables({ steps: rhythmUpdated, pitchCurve, gridStartSec, stepDurationSec, tonic, scaleType, allowedPitchClasses })
                        : rhythmUpdated;
                      onUpdateSteps(reanalyzed, true);
                    }}
                    className={`px-1 py-0.2 text-[8.5px] font-mono rounded-xs cursor-pointer transition-colors leading-tight ${
                      isMatch ? 'bg-[#9a3412] text-white font-black' : preset.isTriplet ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 font-semibold' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/80 hover:bg-amber-500/20 hover:text-theme-ink'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
