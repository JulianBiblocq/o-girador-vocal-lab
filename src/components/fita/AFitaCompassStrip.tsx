/**
 * AFitaCompassStrip.tsx
 * Boussole compacte « A Fita » à 2 pistes (#9a3412 / #0f766e) au-dessus du Piano Roll au Livret 4 (< 115 lignes).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Mic, Music, VolumeX } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';

interface AFitaCompassStripProps {
  isPlaying?: boolean;
  headerRight?: React.ReactNode;
}

export const AFitaCompassStrip: React.FC<AFitaCompassStripProps> = ({ isPlaying = false, headerRight }) => {
  const { project, activePattern, setActivePatternId } = useToadaProject();
  const { t, language } = useLanguage(), isBr = language === 'br';
  const total = project.patterns.length;
  const curIdx = Math.max(0, project.patterns.findIndex((p) => p.id === activePattern.id));
  const isPux = activePattern.role === 'puxador';
  const measureSuffix = isBr ? 'C' : 'M';

  const hasAudio = Boolean(activePattern.recordingResult?.pcm?.length || activePattern.rawAudioSamples?.length);
  const hasNotes = Boolean(activePattern.pack || activePattern.mainSteps?.some((s) => s.active));

  const stepPattern = (delta: number) => {
    if (total <= 1) return;
    const next = project.patterns[(curIdx + delta + total) % total];
    if (next) setActivePatternId(next.id);
  };

  return (
    <div className="w-full cordel-card px-2.5 py-1.5 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono select-none">
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-theme-accent shrink-0 ${isPlaying ? 'fita-reel-spinning' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
        </svg>
        <button type="button" onClick={() => stepPattern(-1)} disabled={total <= 1} title={t('fitaPrevPhrase')} className="p-1 cordel-card-sm rounded cursor-pointer disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span className={`px-1.5 py-0.5 text-[10px] font-black uppercase rounded text-white ${isPux ? 'bg-[#9a3412]' : 'bg-[#0f766e]'}`}>
          {isPux ? t('rolePuxador') : t('roleCoro')}
        </span>
        <select value={activePattern.id} onChange={(e) => setActivePatternId(e.target.value)} className="cordel-card-sm px-2 py-0.5 font-bold text-xs text-theme-ink rounded cursor-pointer max-w-[210px]">
          {project.patterns.map((p, idx) => (
            <option key={p.id} value={p.id}>{idx + 1}/{total} • {p.name} ({p.measuresCount}{measureSuffix})</option>
          ))}
        </select>
        <button type="button" onClick={() => stepPattern(1)} disabled={total <= 1} title={t('fitaNextPhrase')} className="p-1 cordel-card-sm rounded cursor-pointer disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>

        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${hasAudio ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15' : 'opacity-45'}`}>
          <Mic className="w-3 h-3" />
        </span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${hasNotes ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15' : 'opacity-45'}`}>
          <Music className="w-3 h-3" />
        </span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto max-w-full sm:max-w-[46%] py-0.5 cordel-scrollbar">
        {project.slots.map((slot, idx) => {
          const isSilence = !slot.puxadorPatternId && !slot.coroPatternId;
          const isSlotActive = slot.puxadorPatternId === activePattern.id || slot.coroPatternId === activePattern.id;
          const targetId = slot.puxadorPatternId || slot.coroPatternId;
          return (
            <button
              key={slot.slotId}
              type="button"
              disabled={isSilence}
              onClick={() => targetId && setActivePatternId(targetId)}
              title={isSilence ? `${t('conductorPauseShort')} (${slot.advanceMeasures || 1}${measureSuffix})` : t('blockLabel', { n: idx + 1 })}
              className={`h-6 min-w-[26px] px-1 rounded border flex flex-col justify-center gap-[2px] cursor-pointer transition-all shrink-0 ${
                isSlotActive ? 'border-amber-500 ring-2 ring-amber-500/60 bg-amber-500/15' : isSilence ? 'border-dashed border-amber-600/50 opacity-60 cursor-default' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] opacity-80 hover:opacity-100'
              }`}
            >
              {isSilence ? (
                <VolumeX className="w-2.5 h-2.5 mx-auto text-amber-700 dark:text-amber-300" />
              ) : (
                <>
                  <span className={`h-[3px] w-full rounded-xs ${slot.puxadorPatternId ? 'bg-[#9a3412]' : 'bg-stone-400/25'}`} />
                  <span className={`h-[3px] w-full rounded-xs ${slot.coroPatternId ? 'bg-[#0f766e]' : 'bg-stone-400/25'}`} />
                </>
              )}
            </button>
          );
        })}
      </div>

      {headerRight && <div className="inline-flex items-center gap-1.5 flex-wrap">{headerRight}</div>}
    </div>
  );
};
