/**
 * PatternCompassBar.tsx
 * Mini-bandeau Boussole de Pattern avec indicateurs distincts Audio et MIDI + mode compact (< 118 lignes).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Mic, Music } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import type { VocalPatternItem } from '../../types/toadaProject.types';

export function resolvePatternAudioSource(pat: VocalPatternItem, fallbackSampleRate = 44100): { pcm: Float32Array | null; sampleRate: number } {
  const activeV = pat.variants?.[pat.activeVariantKey];
  if (activeV?.recordingResult?.pcm?.length) {
    return { pcm: activeV.recordingResult.pcm, sampleRate: activeV.recordingResult.sampleRate || fallbackSampleRate };
  }
  if (pat.recordingResult?.pcm?.length) {
    return { pcm: pat.recordingResult.pcm, sampleRate: pat.recordingResult.sampleRate || fallbackSampleRate };
  }
  if (pat.rawAudioSamples?.length) {
    return { pcm: pat.rawAudioSamples, sampleRate: pat.pack?.audio?.sampleRate || fallbackSampleRate };
  }
  const anyVar = Object.values(pat.variants || {}).find((v) => v?.recordingResult?.pcm?.length);
  if (anyVar?.recordingResult?.pcm?.length) {
    return { pcm: anyVar.recordingResult.pcm, sampleRate: anyVar.recordingResult.sampleRate || fallbackSampleRate };
  }
  return { pcm: null, sampleRate: fallbackSampleRate };
}

export function checkPatternHasAudio(pat: VocalPatternItem): boolean {
  return Boolean(resolvePatternAudioSource(pat).pcm?.length || (pat as any).audioUrl);
}

export function checkPatternHasMidi(pat: VocalPatternItem): boolean {
  return Boolean(
    pat.pack &&
    ((pat.mainSteps?.some((s) => s.active && s.midiNumber > 0)) ||
      (pat.anacrusisSteps?.some((s) => s.active && s.midiNumber > 0)))
  );
}

export const PatternCompassBar: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
  const { project, activePattern, setActivePatternId } = useToadaProject();
  const { t } = useLanguage();

  const patterns = project.patterns;
  const currentIndex = patterns.findIndex((p) => p.id === activePattern.id);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const handlePrev = () => {
    if (safeIndex > 0) setActivePatternId(patterns[safeIndex - 1].id);
    else if (patterns.length > 0) setActivePatternId(patterns[patterns.length - 1].id);
  };

  const handleNext = () => {
    if (safeIndex < patterns.length - 1) setActivePatternId(patterns[safeIndex + 1].id);
    else if (patterns.length > 0) setActivePatternId(patterns[0].id);
  };

  const isPuxador = activePattern.role === 'puxador';
  const audioCount = patterns.filter(checkPatternHasAudio).length;
  const midiCount = patterns.filter(checkPatternHasMidi).length;

  const selectEl = (
    <select
      value={activePattern.id}
      onChange={(e) => setActivePatternId(e.target.value)}
      aria-label={t('compassSelectAria')}
      className={`bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-xs font-mono font-bold text-theme-ink px-2 py-1 outline-none rounded cursor-pointer truncate ${compact ? 'max-w-[180px] sm:max-w-[240px]' : 'max-w-[200px] sm:max-w-xs md:max-w-md'}`}
    >
      {patterns.map((pat, idx) => {
        const hasAudio = checkPatternHasAudio(pat);
        const hasMidi = checkPatternHasMidi(pat);
        const roleTag = pat.role === 'puxador' ? '[PUX]' : '[CORO]';
        const badges = [hasAudio ? '[Voix]' : '', hasMidi ? '[MIDI]' : ''].filter(Boolean).join(' ');
        return (
          <option key={pat.id} value={pat.id} className="bg-[var(--cordel-surface)] text-theme-ink">
            {idx + 1}. {roleTag} {pat.name} ({pat.measuresCount}M){badges ? ` ${badges}` : ''}
          </option>
        );
      })}
    </select>
  );

  if (compact) {
    return (
      <div className={`flex items-center gap-1 select-none ${className}`}>
        <button type="button" onClick={handlePrev} title={t('compassPrevTooltip')} className="cordel-btn px-1.5 py-1 text-xs font-mono flex items-center cursor-pointer rounded">
          <ChevronLeft className="w-3.5 h-3.5 text-theme-accent" />
        </button>
        {selectEl}
        <button type="button" onClick={handleNext} title={t('compassNextTooltip')} className="cordel-btn px-1.5 py-1 text-xs font-mono flex items-center cursor-pointer rounded">
          <ChevronRight className="w-3.5 h-3.5 text-theme-accent" />
        </button>
      </div>
    );
  }

  return (
    <div className={`cordel-card p-1.5 sm:p-2 flex items-center justify-between gap-2 select-none rounded ${className}`}>
      <button type="button" onClick={handlePrev} title={t('compassPrevTooltip')} className="h-8 px-2 cordel-btn font-mono text-xs flex items-center gap-1 cursor-pointer shrink-0">
        <ChevronLeft className="w-4 h-4 text-theme-accent" /><span className="hidden sm:inline">◀</span>
      </button>
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <span className={`px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded shrink-0 ${isPuxador ? 'bg-role-puxador text-white' : 'bg-role-coro text-white'}`}>
          {isPuxador ? t('rolePuxador') : t('roleCoro')}
        </span>
        {selectEl}
        <span className="text-[10.5px] font-mono font-bold text-[var(--cordel-secondary-text)] shrink-0 hidden md:inline-flex items-center gap-1">
          <span>{safeIndex + 1}/{patterns.length}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-0.5"><Mic className="w-3 h-3 text-theme-accent" />{audioCount}/{patterns.length}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-0.5"><Music className="w-3 h-3 text-theme-accent" />{midiCount}/{patterns.length}</span>
        </span>
      </div>
      <button type="button" onClick={handleNext} title={t('compassNextTooltip')} className="h-8 px-2 cordel-btn font-mono text-xs flex items-center gap-1 cursor-pointer shrink-0">
        <span className="hidden sm:inline">▶</span><ChevronRight className="w-4 h-4 text-theme-accent" />
      </button>
    </div>
  );
};
