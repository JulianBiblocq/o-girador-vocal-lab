/**
 * BeatRhythmPresetBar.tsx
 * Barre épinglée (Docked Footer) des figures rythmiques Maracatu en 1 clic sous chaque temps du Piano Roll :
 * [1───], [1-3], [2-4], [1-2-4], [_2-3-4], [1-2-3-4] (< 120 lignes).
 */
import React from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';
import { useLanguage } from '../../i18n/LanguageContext';

export interface BeatRhythmPreset {
  id: string; label: string; subdivs: number[]; titleFr: string; titleBr: string;
}

export const MARACATU_BEAT_PRESETS: BeatRhythmPreset[] = [
  { id: '1---', label: '1───', subdivs: [0], titleFr: 'Temps plein tenu (Noire)', titleBr: 'Tempo inteiro sustentado (Semínima)' },
  { id: '1-3', label: '1-3', subdivs: [0, 2], titleFr: 'Temps + Contretemps (2 croches)', titleBr: 'Tempo + Contratempo (2 colcheias)' },
  { id: '2-4', label: '2-4', subdivs: [1, 3], titleFr: 'Syncopes Maracatu (2e et 4e doubles)', titleBr: 'Síncopes Maracatu (2ª e 4ª semicolcheias)' },
  { id: '1-2-4', label: '1-2-4', subdivs: [0, 1, 3], titleFr: 'Figure Maracatu 3 coups (1 - 2 - 4)', titleBr: 'Figura Maracatu 3 toques (1 - 2 - 4)' },
  { id: '_2-3-4', label: '_2-3-4', subdivs: [1, 2, 3], titleFr: 'Soupir sur le temps + 3 doubles (_ 2 - 3 - 4)', titleBr: 'Pausa na cabeça + 3 semicolcheias (_ 2 - 3 - 4)' },
  { id: '1-2-3-4', label: '1-2-3-4', subdivs: [0, 1, 2, 3], titleFr: '4 doubles-croches (1 - 2 - 3 - 4)', titleBr: '4 semicolcheias (1 - 2 - 3 - 4)' },
];

export function applyBeatRhythmPreset(
  allSteps: VocalStepData[], beatIndex: number, presetSubdivs: number[], resPerBeat = 4
): VocalStepData[] {
  const bStart = beatIndex * resPerBeat, bEnd = Math.min(allSteps.length, bStart + resPerBeat);
  if (bStart < 0 || bStart >= allSteps.length || presetSubdivs.length === 0) return allSteps;

  const next = allSteps.map((s) => ({ ...s }));
  const syls: string[] = [], midis: number[] = [];
  let fallbackMidi = 60;
  for (let i = 0; i < allSteps.length; i++) {
    if (allSteps[i].active && allSteps[i].midiNumber > 0) { fallbackMidi = allSteps[i].midiNumber; break; }
  }
  for (let i = bStart; i < bEnd; i++) {
    const st = allSteps[i];
    if (st.active && st.midiNumber > 0) fallbackMidi = st.midiNumber;
    if (st.active && st.note !== '───') {
      if (st.syllable && st.syllable.trim()) syls.push(st.syllable.trim());
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

  const onsetSet = new Map<number, number>();
  presetSubdivs.forEach((sub, idx) => onsetSet.set(sub, idx));
  let curMidi = midis[0] || fallbackMidi, seenFirstOnset = false;

  for (let s = 0; s < bEnd - bStart; s++) {
    const idx = bStart + s, base = next[idx];
    if (onsetSet.has(s)) {
      const k = onsetSet.get(s)!;
      curMidi = midis[Math.min(k, Math.max(0, midis.length - 1))] || fallbackMidi;
      seenFirstOnset = true;
      next[idx] = { ...base, active: true, isTie: false, midiNumber: curMidi, note: midiToNoteName(curMidi), syllable: assignedSyls[k] || '' };
    } else if (seenFirstOnset) {
      next[idx] = { ...base, active: true, isTie: true, midiNumber: curMidi, note: '───', syllable: '' };
    } else {
      next[idx] = { ...base, active: false, isTie: false, midiNumber: 0, note: 'C4', syllable: '' };
    }
  }
  return next;
}

interface BeatRhythmPresetBarProps {
  allSteps: VocalStepData[]; gridWidth: number; resPerBeat?: number; readOnly?: boolean;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
}

export const BeatRhythmPresetBar: React.FC<BeatRhythmPresetBarProps> = ({
  allSteps, gridWidth, resPerBeat = 4, readOnly = false, onUpdateSteps,
}) => {
  const { language } = useLanguage();
  if (readOnly || allSteps.length === 0) return null;
  const totalBeats = Math.floor(allSteps.length / resPerBeat);
  const beatWidth = gridWidth / Math.max(1, totalBeats);

  return (
    <div
      className="flex items-center border-t border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] py-0.5 select-none"
      style={{ width: `${64 + gridWidth}px`, height: '26px' }}
    >
      <div className="sticky left-0 z-20 shrink-0 w-[64px] h-full bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex items-center justify-center">
        <span className="text-[7.5px] font-mono font-bold text-[var(--cordel-secondary-text)] tracking-wider uppercase">
          {language === 'br' ? 'RITMO' : 'RYTHME'}
        </span>
      </div>
      <div className="flex items-center h-full" style={{ width: `${gridWidth}px` }}>
        {Array.from({ length: totalBeats }, (_, bIdx) => {
          const bStart = bIdx * resPerBeat, activeSubdivs: number[] = [];
          for (let s = 0; s < resPerBeat && bStart + s < allSteps.length; s++) {
            const st = allSteps[bStart + s];
            if (st.active && st.note !== '───') activeSubdivs.push(s);
          }
          const sig = activeSubdivs.join('-');
          return (
            <div key={bIdx} style={{ width: `${beatWidth}px` }} className="flex items-center justify-center gap-0.5 px-0.5 border-r border-[var(--cordel-border-sub)] overflow-hidden h-full">
              {MARACATU_BEAT_PRESETS.map((preset) => {
                const isMatch = preset.subdivs.join('-') === sig;
                return (
                  <button
                    key={preset.id} type="button" title={`T${bIdx + 1} : ${language === 'br' ? preset.titleBr : preset.titleFr}`}
                    onClick={() => onUpdateSteps(applyBeatRhythmPreset(allSteps, bIdx, preset.subdivs, resPerBeat), true)}
                    className={`px-1 py-0.2 text-[9px] font-mono rounded-xs cursor-pointer transition-colors leading-tight ${
                      isMatch ? 'bg-[#9a3412] text-white font-black' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/80 hover:bg-amber-500/20 hover:text-theme-ink'
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
