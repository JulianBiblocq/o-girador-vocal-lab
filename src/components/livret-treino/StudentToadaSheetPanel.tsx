/**
 * StudentToadaSheetPanel.tsx
 * Onglet 1 de l'espace Élève : Fiche & Paroles complètes (Puxador #9a3412 / Coro #0f766e),
 * résumé structure + pauses Baque, badges BPM/Tonalité, écoute 100 % / 75 % WSOLA, Culture & QCM (< 130 lignes).
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Drum, Music2, Play, Square, VolumeX, BookOpen } from 'lucide-react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { resolveProjectDualScale } from '../../utils/scaleTranspositionHelper';
import { cleanHtmlText } from '../../utils/htmlLyricsHelper';
import { resolvePatternAudioSource } from '../common/PatternCompassBar';
import { getOrComputeTroupeTransposedPCM } from '../../audio/formantPreservingPitchShifter';
import { timeStretchConstantPitch } from '../../audio/wsolaTimeStretcher';
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { CulturalInsightCard } from './CulturalInsightCard';
import { StudentToadaQuizCard } from './StudentToadaQuizCard';

export function formatCleanLyric(raw?: string, fallback?: string): string {
  const txt = cleanHtmlText(raw || '', false).replace(/\[[^\]]+\]/g, ' ').replace(/\b0\b/g, ' ').replace(/_+/g, '').replace(/\s+/g, ' ').trim();
  return txt || fallback || '';
}

function normalizeForPhoneticComparison(str?: string): string {
  return formatCleanLyric(str).toLowerCase().replace(/[.,;:!?¡¿…«»"“”'’()[\]\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function shouldDisplayPhoneticLine(lyricText?: string, phoneticText?: string): boolean {
  const normPhon = normalizeForPhoneticComparison(phoneticText);
  if (!normPhon) return false;
  return normPhon !== normalizeForPhoneticComparison(lyricText);
}

export const StudentToadaSheetPanel: React.FC = () => {
  const { project } = useToadaProject();
  const { recordedSampleRate } = useAudioHardware();
  const { t, language } = useLanguage(), isBr = language === 'br';
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const dualScale = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const bpm = project.toadaMeta?.bpmDefaut || project.bpm || 88;
  const measureSuffix = isBr ? 'C' : 'M';

  const stopPhrase = () => {
    if (srcRef.current) {
      try { srcRef.current.stop(); } catch {}
      try { srcRef.current.disconnect(); } catch {}
      srcRef.current = null;
    }
    setPlayingKey(null);
  };

  useEffect(() => {
    const unregister = registerAudioKillSwitch('student-sheet-player', stopPhrase);
    return () => { unregister(); stopPhrase(); };
  }, []);

  const handlePlayPhrase = async (pat: VocalPatternItem, speedRatio: 1 | 0.75) => {
    const key = `${pat.id}_${speedRatio}`;
    if (playingKey === key) { stopPhrase(); return; }
    stopPhrase(); stopAllActiveAudioEngines('student-sheet-player');
    const { pcm: basePcm, sampleRate } = resolvePatternAudioSource(pat, recordedSampleRate);
    if (!basePcm || basePcm.length === 0) return;
    const startIdx = Math.max(0, Math.floor((pat.trimStartSec || 0) * sampleRate));
    const endIdx = pat.trimEndSec && pat.trimEndSec > (pat.trimStartSec || 0) ? Math.min(basePcm.length, Math.floor(pat.trimEndSec * sampleRate)) : basePcm.length;
    const sliced = basePcm.subarray(startIdx, Math.max(startIdx + 1, endIdx));
    const troupePcm = dualScale.transpositionSemitones !== 0 ? getOrComputeTroupeTransposedPCM(sliced, sampleRate, dualScale.transpositionSemitones) : sliced;
    const finalPcm = speedRatio < 1 ? timeStretchConstantPitch(troupePcm, sampleRate, speedRatio) : troupePcm;
    const ctx = await getSharedAudioContext();
    const buf = ctx.createBuffer(1, finalPcm.length, sampleRate);
    buf.getChannelData(0).set(finalPcm);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    src.onended = () => { srcRef.current = null; setPlayingKey(null); };
    srcRef.current = src; setPlayingKey(key); src.start(0);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <div className="cordel-card p-4 rounded flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--cordel-border-sub)]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-theme-accent shrink-0" />
            <h2 className="font-cactus text-base sm:text-lg font-bold uppercase tracking-wider text-theme-ink">{project.toadaMeta?.titre || project.title || t('studentSheetTitle')}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
            <span className="px-2.5 py-1 cordel-card-sm rounded font-black inline-flex items-center gap-1.5 text-theme-ink"><Drum className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" /><span>{bpm} BPM</span></span>
            <span className="px-2.5 py-1 cordel-card-sm rounded font-black inline-flex items-center gap-1.5 text-theme-ink"><Music2 className="w-3.5 h-3.5 text-[#0f766e] dark:text-teal-300" /><span>{dualScale.troupeScaleLabel}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] font-mono">
          <span className="font-bold uppercase opacity-70 mr-1">{t('studentStructureSummary')} :</span>
          {project.slots.map((slot, idx) => !slot.puxadorPatternId && !slot.coroPatternId ? (
            <span key={slot.slotId} className="px-2 py-0.5 rounded border border-dashed border-amber-600/60 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold inline-flex items-center gap-1"><VolumeX className="w-3 h-3" /><span>{t('conductorPauseShort')} {slot.advanceMeasures || 1}{measureSuffix}</span></span>
          ) : (
            <span key={slot.slotId} className="inline-flex items-center rounded overflow-hidden border border-[var(--cordel-border-sub)] font-bold">
              <span className="px-1.5 py-0.5 bg-[var(--cordel-subcard-bg)] text-theme-ink">#{idx + 1}</span>
              {slot.puxadorPatternId && <span className="px-1.5 py-0.5 bg-[#9a3412] text-white">P</span>}
              {slot.coroPatternId && <span className="px-1.5 py-0.5 bg-[#0f766e] text-white">C</span>}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {project.patterns.map((pat) => {
            const isPux = pat.role === 'puxador', cleanText = formatCleanLyric(pat.assignedLyricsText, pat.name);
            const hasAudio = Boolean(resolvePatternAudioSource(pat, recordedSampleRate).pcm?.length);
            const isPlay100 = playingKey === `${pat.id}_1`, isPlay75 = playingKey === `${pat.id}_0.75`;
            return (
              <div key={pat.id} className="cordel-card-sm p-2.5 rounded flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded text-white shrink-0 mt-0.5 ${isPux ? 'bg-[#9a3412]' : 'bg-[#0f766e]'}`}>{isPux ? t('rolePuxador') : t('roleCoro')}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-serif text-sm sm:text-base text-theme-ink leading-snug">{cleanText || t('studentNoLyricsYet')}</span>
                    {shouldDisplayPhoneticLine(cleanText, pat.assignedPhoneticText) && <span className="text-[11px] font-mono italic text-[var(--cordel-secondary-text)]">[Phon.] {pat.assignedPhoneticText}</span>}
                  </div>
                </div>
                {hasAudio && (
                  <div className="inline-flex items-center gap-1.5 font-mono text-xs shrink-0">
                    <button type="button" onClick={() => handlePlayPhrase(pat, 1)} className={`px-2.5 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${isPlay100 ? 'bg-red-800 text-white' : 'cordel-btn-primary'}`}>{isPlay100 ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}<span>{isPlay100 ? t('studentStopAudioBtn') : t('studentListen100Btn')}</span></button>
                    <button type="button" onClick={() => handlePlayPhrase(pat, 0.75)} className={`px-2 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${isPlay75 ? 'bg-red-800 text-white' : 'cordel-btn'}`}>{isPlay75 ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}<span>{t('studentListen75Btn')}</span></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <CulturalInsightCard />
      <StudentToadaQuizCard />
    </div>
  );
};
