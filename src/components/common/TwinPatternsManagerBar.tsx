/**
 * TwinPatternsManagerBar.tsx
 * Bandeau compact de gestion des prises répétées / patterns jumeaux (Livrets 1, 3 et 4).
 * Permet d'écouter chaque prise du groupe, de garder 1 prise unique, une Paire A/B,
 * ou de copier Notes MIDI + Rythme + Syllabes vers les jumeaux en gardant leur Audio (< 120 lignes).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getSharedAudioContext, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { findTwinPatterns, findTwinSlotIndices, assignSingleBestTwinToAll, assignTwinPairAB, copyMidiAndSyllablesToTwins } from '../../utils/twinPatternsHelper';
import type { VocalPatternItem } from '../../types/toadaProject.types';

function getShortTag(pat: VocalPatternItem, fallbackIdx: number): string {
  const m = (pat.name || '').match(/^#\d+/);
  return m ? m[0] : `#${fallbackIdx + 1}`;
}

export const TwinPatternsManagerBar: React.FC = () => {
  const { language } = useLanguage();
  const { project, activePattern: activePat, loadProject, setActivePatternId } = useToadaProject();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const tr = (fr: string, br: string) => (language === 'br' ? br : fr);

  const stopPreview = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* ignore */ }
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    setPlayingId(null);
  };

  useEffect(() => () => stopPreview(), []);

  if (!activePat) return null;

  const twins = findTwinPatterns(project, activePat.id);
  const slotIndices = findTwinSlotIndices(project, activePat.id);
  const repeatCount = Math.max(twins.length, slotIndices.length);
  if (twins.length <= 1 && repeatCount <= 1) return null;

  const recordedTwins = twins.filter((p) => Boolean(p.recordingResult?.pcm?.length || p.rawAudioSamples?.length));
  const patA = recordedTwins[0] || twins[0];
  const patB = recordedTwins.find((p) => p.id !== patA.id) || twins.find((p) => p.id !== patA.id) || patA;
  const activeIdx = Math.max(0, twins.findIndex((p) => p.id === activePat.id));
  const activeTag = getShortTag(activePat, activeIdx);
  const tagA = getShortTag(patA, Math.max(0, twins.indexOf(patA)));
  const tagB = getShortTag(patB, Math.max(0, twins.indexOf(patB)));

  const handlePreviewTake = async (pat: VocalPatternItem) => {
    if (playingId === pat.id) { stopPreview(); return; }
    stopPreview();
    stopAllActiveAudioEngines('twin-preview');
    const pcm = pat.correctedAudioSamples || pat.rawAudioSamples || pat.recordingResult?.pcm;
    if (!pcm || pcm.length === 0) return;
    const ctx = await getSharedAudioContext();
    const sr = pat.recordingResult?.sampleRate || pat.pack?.audio?.sampleRate || 44100;
    const buf = ctx.createBuffer(1, pcm.length, sr);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => { sourceRef.current = null; setPlayingId(null); };
    sourceRef.current = src;
    setPlayingId(pat.id);
    const startSec = Math.max(0, pat.trimStartSec || 0);
    const durSec = pat.trimEndSec && pat.trimEndSec > startSec ? pat.trimEndSec - startSec : undefined;
    src.start(0, startSec, durSec);
  };

  const fireToast = (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: msg }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded border border-[var(--cordel-border)] bg-[var(--cordel-panel)] text-[11px] font-mono">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--cordel-wood)] text-[var(--cordel-paper)]">
          {tr(`Phrase répétée ${repeatCount} fois dans le chant`, `Frase repetida ${repeatCount} vezes no canto`)}
        </span>
        {twins.map((tw, idx) => {
          const tag = getShortTag(tw, idx);
          const hasAudio = Boolean(tw.recordingResult?.pcm?.length || tw.rawAudioSamples?.length);
          const isCur = tw.id === activePat.id;
          return (
            <div key={tw.id} className="inline-flex items-center rounded border border-[var(--cordel-border)] overflow-hidden">
              <button type="button" onClick={() => setActivePatternId(tw.id)} className={`px-1.5 py-0.5 font-bold cursor-pointer ${isCur ? 'bg-[var(--cordel-accent)] text-[var(--cordel-paper)]' : 'bg-[var(--cordel-bg)] text-[var(--cordel-text)]'}`}>
                {tr(`Prise ${tag}`, `Tomada ${tag}`)}
              </button>
              {hasAudio && (
                <button type="button" onClick={() => handlePreviewTake(tw)} className="px-1.5 py-0.5 bg-[var(--cordel-panel)] text-[var(--cordel-text)] hover:bg-[var(--cordel-wood)] hover:text-[var(--cordel-paper)] cursor-pointer border-l border-[var(--cordel-border)]">
                  {playingId === tw.id ? '■' : `▶ Prise ${tag}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => { stopPreview(); loadProject(assignSingleBestTwinToAll(project, activePat.id)); fireToast(tr(`Prise ${activeTag} assignée aux ${repeatCount} répétitions`, `Tomada ${activeTag} atribuída às ${repeatCount} repetições`)); }} className="px-2 py-0.5 rounded border border-[var(--cordel-border)] bg-[var(--cordel-bg)] text-[var(--cordel-text)] hover:bg-[var(--cordel-wood)] hover:text-[var(--cordel-paper)] font-bold cursor-pointer">
          {tr(`Garder uniquement cette prise (${activeTag}) pour les ${repeatCount}`, `Manter apenas esta tomada (${activeTag}) para as ${repeatCount}`)}
        </button>
        {twins.length >= 2 && patA.id !== patB.id && (
          <button type="button" onClick={() => { stopPreview(); loadProject(assignTwinPairAB(project, patA.id, patB.id)); fireToast(tr(`Paire (${tagA} + ${tagB}) assignée sur les ${repeatCount} mesures`, `Par (${tagA} + ${tagB}) atribuído nos ${repeatCount} compassos`)); }} className="px-2 py-0.5 rounded border border-[var(--cordel-border)] bg-[var(--cordel-bg)] text-[var(--cordel-text)] hover:bg-[var(--cordel-wood)] hover:text-[var(--cordel-paper)] font-bold cursor-pointer">
            {tr(`Garder 2 prises (Paire ${tagA} + ${tagB}) et répéter sur la suite`, `Manter 2 tomadas (Par ${tagA} + ${tagB}) e repetir a seguir`)}
          </button>
        )}
        {twins.length > 1 && (
          <button type="button" onClick={() => { loadProject(copyMidiAndSyllablesToTwins(project, activePat.id)); fireToast(tr('Notes MIDI, rythme et syllabes copiés vers le pattern jumeau (Audio conservé)', 'Notas MIDI, ritmo e sílabas copiados para o padrão gêmeo (Áudio preservado)')); }} className="px-2 py-0.5 rounded border border-[var(--cordel-accent)] bg-[var(--cordel-accent)] text-[var(--cordel-paper)] font-bold cursor-pointer">
            {tr(`Copier Notes & Syllabes ➔ Jumeaux (${twins.length - 1}) (garder leur Audio)`, `Copiar Notas & Sílabas ➔ Gêmeos (${twins.length - 1}) (manter Áudio)`)}
          </button>
        )}
      </div>
    </div>
  );
};
