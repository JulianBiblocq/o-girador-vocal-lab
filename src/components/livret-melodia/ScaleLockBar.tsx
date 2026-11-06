/**
 * ScaleLockBar.tsx
 * Bandeau Double Tonalité bilingue (FR / PT-BR) : Prise chantée (aimantation Piano Roll sur l'onde brute)
 * ➔ Tonalité Troupe (-6..+6 st) + Écoute comparative directe [ Prise | Troupe ] (< 130 lignes).
 */
import React, { useState, useEffect } from 'react';
import type { PitchCurvePoint } from '../../types/vocalPack.types';
import { type ScaleType, buildAllowedPitchClasses, detectBestScaleFromPitchCurve, getTonicSemitone } from '../../audio/scaleQuantizer';
import { SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR, formatProjectScaleLabel } from '../../audio/projectScaleAnalyzer';
import { transposePitchClass, computeSemitoneDistance, clampTranspositionSemitones } from '../../utils/scaleTranspositionHelper';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import { Lock, Unlock, Target, Mic, Ear, ChevronLeft, ChevronRight } from 'lucide-react';

const SCALE_MODES_FR: Array<{ key: ScaleType; label: string }> = [
  { key: 'chromatic', label: 'Libre / Chromatique' }, { key: 'major', label: 'Majeur' },
  { key: 'natural_minor', label: 'Mineur naturel' }, { key: 'mixolydian', label: 'Mixolydien (Nordeste)' },
  { key: 'dorian', label: 'Dorien' }, { key: 'harmonic_minor', label: 'Mineur harm.' },
  { key: 'pentatonic_minor', label: 'Pentatonique min.' }, { key: 'pentatonic_major', label: 'Pentatonique maj.' },
];

const SCALE_MODES_BR: Array<{ key: ScaleType; label: string }> = [
  { key: 'chromatic', label: 'Livre / Cromática' }, { key: 'major', label: 'Maior' },
  { key: 'natural_minor', label: 'Menor natural' }, { key: 'mixolydian', label: 'Mixolídio (Nordeste)' },
  { key: 'dorian', label: 'Dórico' }, { key: 'harmonic_minor', label: 'Menor harm.' },
  { key: 'pentatonic_minor', label: 'Pentatônica men.' }, { key: 'pentatonic_major', label: 'Pentatônica mai.' },
];

export interface ScaleLockBarProps {
  tonic: string; scaleType: ScaleType; customPitchClasses?: number[] | null;
  pitchCurve: PitchCurvePoint[]; defaultKeyStr?: string;
  transpositionSemitones?: number; listenTarget?: 'sung' | 'troupe';
  onUpdateScale: (tonic: string, scaleType: ScaleType, customPitchClasses: number[] | null) => void;
  onChangeTransposition?: (newSemitones: number) => void;
  onChangeListenTarget?: (target: 'sung' | 'troupe') => void;
  onAnalyzeFullProjectScale?: () => void;
}

export const ScaleLockBar: React.FC<ScaleLockBarProps> = ({
  tonic, scaleType, customPitchClasses = null, pitchCurve, defaultKeyStr,
  transpositionSemitones = 0, listenTarget = 'sung',
  onUpdateScale, onChangeTransposition, onChangeListenTarget, onAnalyzeFullProjectScale,
}) => {
  const { language } = useLanguage(), isBr = language === 'br';
  const solfegeLabels = isBr ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES, scaleModes = isBr ? SCALE_MODES_BR : SCALE_MODES_FR;
  const [lastActiveMode, setLastActiveMode] = useState<ScaleType>('natural_minor');
  useEffect(() => { if (scaleType !== 'chromatic') setLastActiveMode(scaleType); }, [scaleType]);

  const allowedSet = buildAllowedPitchClasses(tonic, scaleType, customPitchClasses);
  const isLocked = scaleType !== 'chromatic' || (customPitchClasses !== null && customPitchClasses.length < 12);
  const sungIdx = getTonicSemitone(tonic), sungSolfege = solfegeLabels[sungIdx] || tonic;
  const effectiveMode = isLocked ? scaleType : lastActiveMode;
  const shiftSt = clampTranspositionSemitones(transpositionSemitones), troupeRoot = transposePitchClass(tonic, shiftSt);
  const troupeIdx = getTonicSemitone(troupeRoot), troupeSolfege = solfegeLabels[troupeIdx] || troupeRoot;
  const troupeFullLabel = formatProjectScaleLabel(troupeRoot, effectiveMode, language);
  const stBadge = shiftSt === 0 ? '0 st' : shiftSt > 0 ? `+${shiftSt} st` : `${shiftSt} st`;

  return (
    <div className="cordel-card px-2.5 py-2 flex flex-col gap-1.5 rounded text-[11px] font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button" onClick={() => onUpdateScale(tonic, isLocked ? 'chromatic' : lastActiveMode, null)}
            className={`px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer border transition-colors ${isLocked ? 'bg-emerald-700 text-white border-emerald-500 shadow-2xs' : 'bg-[#451a03] text-[#f4ecd8] border-[#9a3412]'}`}
            title={isBr ? 'Travar ou desativar a escala da gravação original' : 'Verrouiller ou débrayer la gamme de la prise chantée'}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <Mic className="w-3.5 h-3.5" /><span>{isBr ? 'Tom cantado :' : 'Prise chantée :'}</span>
          </button>
          <select value={NOTE_NAMES[sungIdx] || 'A'} onChange={(e) => onUpdateScale(e.target.value, effectiveMode, null)} className="cordel-card-sm px-1.5 py-1 font-bold text-theme-accent rounded cursor-pointer">
            {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeLabels[i]} ({n})</option>)}
          </select>
          <select value={scaleType} onChange={(e) => onUpdateScale(tonic, e.target.value as ScaleType, null)} className="cordel-card-sm px-1.5 py-1 font-bold text-theme-accent rounded cursor-pointer">
            {scaleModes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button
            type="button" onClick={() => { if (onAnalyzeFullProjectScale) onAnalyzeFullProjectScale(); const det = detectBestScaleFromPitchCurve(pitchCurve, defaultKeyStr); onUpdateScale(det.tonic, det.scaleType, null); }}
            className="px-2 py-1 rounded cordel-card-sm hover:border-amber-500 font-bold flex items-center gap-1 cursor-pointer text-[#9a3412] dark:text-amber-300"
          >
            <Target className="w-3.5 h-3.5" /><span>{isBr ? 'Auto-detectar' : 'Auto-détecter'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/40">
          <span className="font-bold text-[#9a3412] dark:text-amber-300 inline-flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /><span>{isBr ? 'Tom do Batuque (Tropa) :' : 'Tonalité Troupe :'}</span>
          </span>
          <button type="button" onClick={() => onChangeTransposition?.(clampTranspositionSemitones(shiftSt - 1))} className="px-1.5 py-0.5 cordel-btn rounded font-bold flex items-center cursor-pointer"><ChevronLeft className="w-3 h-3" />-1</button>
          <select value={troupeRoot} onChange={(e) => onChangeTransposition?.(computeSemitoneDistance(tonic, e.target.value))} className="cordel-card-sm px-1.5 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 rounded cursor-pointer">
            {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfegeLabels[i]} ({n})</option>)}
          </select>
          <span className="font-bold text-theme-ink">{troupeFullLabel} <strong className="text-[#9a3412] dark:text-amber-300">({stBadge})</strong></span>
          <button type="button" onClick={() => onChangeTransposition?.(clampTranspositionSemitones(shiftSt + 1))} className="px-1.5 py-0.5 cordel-btn rounded font-bold flex items-center cursor-pointer">+1<ChevronRight className="w-3 h-3" /></button>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded cordel-card-sm">
          <span className="px-1.5 text-[10px] font-bold text-[var(--cordel-secondary-text)] inline-flex items-center gap-1">
            <Ear className="w-3.5 h-3.5 text-theme-accent" /><span>{isBr ? 'Ouvir :' : 'Écouter :'}</span>
          </span>
          <button type="button" onClick={() => onChangeListenTarget?.('sung')} className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${listenTarget === 'sung' ? 'bg-theme-wood text-[#f4ecd8]' : 'opacity-70 hover:opacity-100'}`}>
            <Mic className="w-3 h-3" /><span>{isBr ? `Gravação (${sungSolfege})` : `Prise (${sungSolfege})`}</span>
          </button>
          <button type="button" onClick={() => onChangeListenTarget?.('troupe')} className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${listenTarget === 'troupe' ? 'bg-[#0f766e] text-white' : 'opacity-70 hover:opacity-100'}`}>
            <Target className="w-3 h-3" /><span>{isBr ? `Tropa (${troupeSolfege} ${stBadge})` : `Troupe (${troupeSolfege} ${stBadge})`}</span>
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="flex items-center gap-1 flex-wrap pt-0.5 border-t border-[var(--cordel-border-sub)]">
          <span className="text-[10px] opacity-75 mr-1">{isBr ? 'Notas da gravação :' : 'Notes de la prise :'}</span>
          {solfegeLabels.map((lbl, pc) => (
            <button key={pc} type="button" onClick={() => { const next = new Set(allowedSet); if (next.has(pc) && next.size > 1) next.delete(pc); else next.add(pc); onUpdateScale(tonic, effectiveMode, Array.from(next).sort((a, b) => a - b)); }} className={`px-1.5 py-0.2 rounded text-[10px] font-bold cursor-pointer border ${allowedSet.has(pc) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-stone-500/10 text-theme-ink/40 border-transparent'}`}>{lbl}</button>
          ))}
        </div>
      )}
    </div>
  );
};
