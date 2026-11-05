/**
 * StructureMusicConfigPanel.tsx
 * Panneau des réglages musicaux du bloc/chant (BPM, Signature, Mesures, Diapason, Anacrouse) (< 125 lignes).
 */
import React from 'react';
import { Sliders, Clock, Music2, Volume2, Play, Grid } from 'lucide-react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { MetricScopeSelector } from '../livret-prise/MetricScopeSelector';
import type { TranslationKey } from '../../i18n/i18n.types';

const NOTE_KEYS: { c: string; k: TranslationKey }[] = [
  { c: 'C', k: 'note_C' }, { c: 'C#', k: 'note_Cs' }, { c: 'D', k: 'note_D' }, { c: 'D#', k: 'note_Ds' },
  { c: 'E', k: 'note_E' }, { c: 'F', k: 'note_F' }, { c: 'F#', k: 'note_Fs' }, { c: 'G', k: 'note_G' },
  { c: 'G#', k: 'note_Gs' }, { c: 'A', k: 'note_A' }, { c: 'A#', k: 'note_As' }, { c: 'B', k: 'note_B' },
];

interface StructureMusicConfigPanelProps {
  timeSignature: TimeSignatureString;
  onTimeSignatureChange: (sig: TimeSignatureString) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measuresCount: number;
  onMeasuresCountChange: (count: number) => void;
  hasAnacrusis: boolean;
  onHasAnacrusisChange: (has: boolean) => void;
  referencePitch: string;
  onReferencePitchChange: (pitch: string) => void;
  onPlayPitchPreview?: () => void;
  beatResolutions: number[];
  onBeatResolutionsChange: (res: number[]) => void;
}

export const StructureMusicConfigPanel: React.FC<StructureMusicConfigPanelProps> = ({
  timeSignature, onTimeSignatureChange, bpm, onBpmChange, measuresCount, onMeasuresCountChange,
  hasAnacrusis, onHasAnacrusisChange, referencePitch, onReferencePitchChange, onPlayPitchPreview,
  beatResolutions, onBeatResolutionsChange,
}) => {
  const { t } = useLanguage();
  const { applyScope, setApplyScope, selectedPatternIds } = useToadaProject();

  const match = referencePitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
  const currentNote = match ? match[1].toUpperCase() : 'C';
  const currentOctave = match ? match[2] : '4';

  const toggleResolution = (idx: number) => {
    const next = [...beatResolutions];
    next[idx] = next[idx] === 4 ? 3 : 4;
    onBeatResolutionsChange(next);
  };

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5">
      <MetricScopeSelector applyScope={applyScope} onApplyScopeChange={setApplyScope} selectedCount={selectedPatternIds.length} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-[var(--cordel-border-sub)]">
        {/* Signature & Mesures */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
            <span className="flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-theme-accent" />{t('timeSignature')}</span>
            <span className="font-mono text-theme-accent text-xs">{timeSignature}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(['2/4', '3/4', '4/4', '6/8'] as TimeSignatureString[]).map((sig) => (
              <button key={sig} type="button" onClick={() => onTimeSignatureChange(sig)} className={`py-1 text-xs font-mono font-bold rounded cursor-pointer ${timeSignature === sig ? 'cordel-btn-primary' : 'cordel-btn'}`}>{sig}</button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink pt-1.5">
            <span className="flex items-center gap-1.5"><Music2 className="w-3.5 h-3.5 text-theme-accent" />{t('measuresCount')} (N)</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((cnt) => (
              <button key={cnt} type="button" onClick={() => onMeasuresCountChange(cnt)} className={`py-1 text-xs font-bold rounded cursor-pointer ${measuresCount === cnt ? 'cordel-btn-primary' : 'cordel-btn'}`}>{t('measureUnitShort', { n: cnt })}</button>
            ))}
          </div>
        </div>

        {/* BPM & Anacrouse */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-theme-accent" />BPM</span>
            <NumericDraftInput min={30} max={240} value={bpm} onChange={onBpmChange} className="w-14 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-center font-mono font-bold text-xs p-1 rounded" />
          </div>
          <input type="range" min={30} max={240} value={bpm} onChange={(e) => onBpmChange(Number(e.target.value))} className="w-full accent-[var(--cordel-wood)] cursor-pointer" />

          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink pt-1">
            <span>{t('anacrusisOption')} (M-1)</span>
            <div className="inline-flex cordel-card-sm p-0.5 text-xs font-mono">
              <button type="button" onClick={() => onHasAnacrusisChange(true)} className={`px-2.5 py-0.5 font-bold rounded cursor-pointer ${hasAnacrusis ? 'cordel-btn-primary' : 'opacity-60'}`}>{t('hasAnacrusisYes')}</button>
              <button type="button" onClick={() => onHasAnacrusisChange(false)} className={`px-2.5 py-0.5 font-bold rounded cursor-pointer ${!hasAnacrusis ? 'cordel-btn-primary' : 'opacity-60'}`}>{t('hasAnacrusisNo')}</button>
            </div>
          </div>
        </div>

        {/* Note repère & Subdivisions */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
            <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-theme-accent" />{t('referencePitch')}</span>
            {onPlayPitchPreview && (
              <button type="button" onClick={onPlayPitchPreview} className="cordel-btn px-2 py-0.5 text-[10.5px] flex items-center gap-1 cursor-pointer">
                <Play className="w-3 h-3 text-theme-accent" /><span>{t('testPitch')}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <select value={currentNote} onChange={(e) => onReferencePitchChange(`${e.target.value}${currentOctave}`)} className="flex-1 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-theme-ink text-xs p-1 font-mono font-bold rounded">
              {NOTE_KEYS.map((n) => <option key={n.c} value={n.c} className="bg-[var(--cordel-surface)] text-theme-ink">{t(n.k)}</option>)}
            </select>
            <select value={currentOctave} onChange={(e) => onReferencePitchChange(`${currentNote}${e.target.value}`)} className="w-16 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-theme-ink text-xs p-1 font-mono font-bold rounded">
              {['2', '3', '4', '5', '6'].map((oct) => <option key={oct} value={oct} className="bg-[var(--cordel-surface)] text-theme-ink">{t('octaveShort', { oct })}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink pt-1">
            <span className="flex items-center gap-1"><Grid className="w-3 h-3 text-theme-accent" />{t('subdivisions')}</span>
          </div>
          <div className="grid grid-flow-col auto-cols-fr gap-1">
            {beatResolutions.map((res, idx) => (
              <button key={idx} type="button" onClick={() => toggleResolution(idx)} className={`p-1 text-center font-mono rounded cursor-pointer ${res === 4 ? 'cordel-card-sm text-theme-ink' : 'cordel-btn-primary'}`}>
                <span className="text-[9px] opacity-70">T{idx + 1}: </span><span className="text-xs font-bold">{res === 4 ? '4' : '3'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
