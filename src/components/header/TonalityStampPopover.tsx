/**
 * TonalityStampPopover.tsx
 * Poinçon gravé interactif [Tonalité] : Double Tonalité (Chanté vs Troupe), Degrés & Diapason Hz (< 130 lignes).
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Music2, Lock, Unlock, Volume2, Search, ChevronLeft, ChevronRight, ChevronDown, Ear } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { buildAllowedPitchClasses, type ScaleType } from '../../audio/scaleQuantizer';
import { SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR, analyzeFullProjectScale } from '../../audio/projectScaleAnalyzer';
import { resolveProjectDualScale, applyDualScaleToProject, clampTranspositionSemitones, computeSemitoneDistance } from '../../utils/scaleTranspositionHelper';
import { syncTonaliteToOrganizadorFirestore } from '../../services/organizadorToadaPublisher';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { DEFAULT_REFERENCE_PITCH_HZ, MIN_REFERENCE_PITCH_HZ, MAX_REFERENCE_PITCH_HZ, sanitizePitchHz } from '../../utils/pitchHzContract';
import { NumericDraftInput } from '../ui/NumericDraftInput';

const MODES: Array<{ key: ScaleType; fr: string; br: string }> = [
  { key: 'major', fr: 'Majeur', br: 'Maior' }, { key: 'natural_minor', fr: 'Mineur', br: 'Menor' },
  { key: 'mixolydian', fr: 'Mixolydien', br: 'Mixolídio' }, { key: 'dorian', fr: 'Dorien', br: 'Dórico' },
  { key: 'harmonic_minor', fr: 'Mineur harm.', br: 'Menor harm.' }, { key: 'pentatonic_minor', fr: 'Pentatonique min.', br: 'Pentatônica men.' },
  { key: 'pentatonic_major', fr: 'Pentatonique maj.', br: 'Pentatônica mai.' }, { key: 'chromatic', fr: 'Chromatique', br: 'Cromática' },
];

export const TonalityStampPopover: React.FC = () => {
  const { project, loadProject } = useToadaProject();
  const { engine, selectedOutputDeviceId } = useAudioHardware();
  const { t, language } = useLanguage(), isBr = language === 'br';
  const [isOpen, setIsOpen] = useState(false), [lastMode, setLastMode] = useState<ScaleType>('natural_minor');
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOut = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setIsOpen(false); };
    const onClose = () => setIsOpen(false);
    document.addEventListener('mousedown', onOut); window.addEventListener('cordel-close-popovers', onClose);
    return () => { document.removeEventListener('mousedown', onOut); window.removeEventListener('cordel-close-popovers', onClose); };
  }, []);

  const dual = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const solfege = isBr ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES;
  const { sungScaleRoot: sungRoot, sungScaleMode: sungMode, transpositionSemitones: shiftSt } = dual;
  const isLocked = sungMode !== 'chromatic';
  useEffect(() => { if (sungMode !== 'chromatic') setLastMode(sungMode); }, [sungMode]);

  const allowedSet = buildAllowedPitchClasses(sungRoot, sungMode, project.customPitchClasses ?? null);
  const pitchHz = sanitizePitchHz(project.referencePitchHz ?? project.toadaMeta?.referencePitchHz ?? DEFAULT_REFERENCE_PITCH_HZ);
  const listenTarget = project.previewListenTarget ?? (shiftSt !== 0 ? 'troupe' : 'sung');
  const stBadge = shiftSt === 0 ? '0 st' : `${shiftSt > 0 ? '+' : ''}${shiftSt} st`;
  const stampText = shiftSt === 0 ? dual.troupeScaleLabel : `${dual.sungSolfegeRoot} -> ${dual.troupeSolfegeRoot} (${stBadge})`;

  const applyDual = (nextRoot: string, nextMode: ScaleType, nextSt = shiftSt) => {
    const nextProj = applyDualScaleToProject(project, nextRoot, nextMode, nextSt, dual.sungReferencePitch, language);
    loadProject(nextProj); syncTonaliteToOrganizadorFirestore(nextProj);
  };

  const handleAutoDetect = () => {
    const res = analyzeFullProjectScale(project.patterns, language);
    const nextProj = applyDualScaleToProject({ ...project, patterns: res.updatedPatterns }, res.tonic, res.scaleType, shiftSt, res.referencePitch, language);
    loadProject(nextProj); syncTonaliteToOrganizadorFirestore(nextProj);
  };

  const handlePitchHzChange = (val: number) => {
    const cleanHz = sanitizePitchHz(val);
    loadProject({ ...project, referencePitchHz: cleanHz, toadaMeta: { ...(project.toadaMeta || {}), referencePitchHz: cleanHz } });
  };

  return (
    <div className="relative inline-flex items-center" ref={popRef}>
      <button type="button" onClick={() => setIsOpen((p) => !p)} title={t('stampTonalityTitle')} className="h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold inline-flex items-center gap-1.5 hover:border-amber-500/70 transition-colors cursor-pointer">
        <Music2 className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300 shrink-0" />
        <span className="text-theme-ink font-black truncate max-w-[165px]">{stampText}</span>
        {pitchHz !== DEFAULT_REFERENCE_PITCH_HZ && <span className="text-[10px] text-[#0f766e] dark:text-teal-300 font-bold">{pitchHz}Hz</span>}
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-9 left-0 z-[100] w-80 cordel-card p-3 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-2 text-xs font-mono rounded">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <button type="button" onClick={() => applyDual(sungRoot, isLocked ? 'chromatic' : lastMode)} className={`px-2 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer border ${isLocked ? 'bg-emerald-700 text-white border-emerald-500' : 'cordel-card-sm text-theme-ink'}`}>
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}<span>{t('stampSungKeyLabel')}</span>
            </button>
            <select value={sungRoot} onChange={(e) => applyDual(e.target.value, isLocked ? sungMode : lastMode)} className="cordel-card-sm px-1.5 py-1 font-bold text-[#9a3412] dark:text-amber-300 rounded cursor-pointer">
              {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfege[i]} ({n})</option>)}
            </select>
            <select value={sungMode} onChange={(e) => applyDual(sungRoot, e.target.value as ScaleType)} className="cordel-card-sm px-1.5 py-1 font-bold text-[#9a3412] dark:text-amber-300 rounded cursor-pointer">
              {MODES.map((m) => <option key={m.key} value={m.key}>{isBr ? m.br : m.fr}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <button type="button" onClick={() => engine.playReferencePitchPreview(listenTarget === 'troupe' ? dual.troupeReferencePitch : dual.sungReferencePitch, 1.4, selectedOutputDeviceId)} className="px-2 py-1 cordel-btn rounded font-bold inline-flex items-center gap-1 cursor-pointer">
              <Volume2 className="w-3.5 h-3.5 text-theme-accent" /><span>{dual.troupeSolfegeRoot}</span>
            </button>
            <button type="button" onClick={handleAutoDetect} className="px-2 py-1 rounded bg-amber-600/20 border border-amber-500/60 text-amber-900 dark:text-amber-200 font-bold inline-flex items-center gap-1 cursor-pointer">
              <Search className="w-3.5 h-3.5" /><span>{t('stampAutoDetectBtn')}</span>
            </button>
          </div>

          {isLocked && (
            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-[var(--cordel-border-sub)]">
              {solfege.map((lbl, pc) => (
                <button key={pc} type="button" onClick={() => { const next = new Set(allowedSet); if (next.has(pc) && next.size > 1) next.delete(pc); else next.add(pc); loadProject({ ...project, customPitchClasses: Array.from(next).sort((a, b) => a - b) }); }} className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${allowedSet.has(pc) ? 'bg-emerald-700 text-white border-emerald-500' : 'bg-stone-500/10 text-theme-ink/45 border-transparent'}`}>{lbl}</button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--cordel-border-sub)]">
            <span className="font-bold text-[#9a3412] dark:text-amber-300">{t('stampTroupeKeyLabel')} :</span>
            <div className="inline-flex items-center gap-1">
              <button type="button" onClick={() => applyDual(sungRoot, sungMode, clampTranspositionSemitones(shiftSt - 1))} className="px-1.5 py-0.5 cordel-btn rounded font-bold flex items-center cursor-pointer"><ChevronLeft className="w-3 h-3" />-1</button>
              <select value={dual.troupeScaleRoot} onChange={(e) => applyDual(sungRoot, sungMode, computeSemitoneDistance(sungRoot, e.target.value))} className="cordel-card-sm px-1.5 py-0.5 font-bold text-[#9a3412] dark:text-amber-300 rounded cursor-pointer">
                {NOTE_NAMES.map((n, i) => <option key={n} value={n}>{solfege[i]} ({n})</option>)}
              </select>
              <button type="button" onClick={() => applyDual(sungRoot, sungMode, clampTranspositionSemitones(shiftSt + 1))} className="px-1.5 py-0.5 cordel-btn rounded font-bold flex items-center cursor-pointer">+1<ChevronRight className="w-3 h-3" /></button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--cordel-border-sub)] text-[11px]">
            <div className="inline-flex items-center gap-1 cordel-card-sm p-0.5 rounded">
              <Ear className="w-3 h-3 ml-1 opacity-70" />
              <button type="button" onClick={() => loadProject({ ...project, previewListenTarget: 'sung' })} className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${listenTarget === 'sung' ? 'bg-[#9a3412] text-white' : 'opacity-70'}`}>{t('stampListenSungBtn')}</button>
              <button type="button" onClick={() => loadProject({ ...project, previewListenTarget: 'troupe' })} className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${listenTarget === 'troupe' ? 'bg-[#0f766e] text-white' : 'opacity-70'}`}>{t('stampListenTroupeBtn')}</button>
            </div>
            <div className="inline-flex items-center gap-1" title={`${MIN_REFERENCE_PITCH_HZ}–${MAX_REFERENCE_PITCH_HZ} Hz`}>
              <span className="opacity-75">La4:</span>
              <NumericDraftInput min={MIN_REFERENCE_PITCH_HZ} max={MAX_REFERENCE_PITCH_HZ} value={pitchHz} onChange={handlePitchHzChange} className="w-12 cordel-card-sm text-center font-bold py-0.5 rounded text-[#0f766e] dark:text-teal-300" />
              <span className="text-[10px] opacity-75">Hz</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
