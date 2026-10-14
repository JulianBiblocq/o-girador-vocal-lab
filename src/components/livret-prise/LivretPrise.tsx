import React, { useState, useMemo, useCallback } from 'react';
import { Play, Square, Sparkles } from 'lucide-react';
import { MetronomeEngine, getBeatsPerMeasure, type ListeningMode } from '../../audio/MetronomeEngine';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { DeviceSelector } from './DeviceSelector';
import { MetricConfigPanel, getDefaultBeatResolutions } from './MetricConfigPanel';
import { ListeningModePanel } from './ListeningModePanel';
import type { VocalRoleTarget, TimeSignatureString } from '../../types/vocalPack.types';

export const LivretPrise: React.FC = () => {
  const engine = useMemo(() => new MetronomeEngine(), []);

  // États du Livret 1
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>('4/4');
  const [bpm, setBpm] = useState<number>(100);
  const [measuresCount, setMeasuresCount] = useState<number>(2);
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions('4/4'));
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones');
  const [referencePitch, setReferencePitch] = useState<string>('C4');
  const [suggestedRole, setSuggestedRole] = useState<VocalRoleTarget>('puxador');
  const [isCycleActive, setIsCycleActive] = useState<boolean>(false);

  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);

  // Lancement synchrone du cycle de test (avec réveil AudioContext)
  const handleToggleCycle = useCallback(async () => {
    if (isCycleActive) {
      engine.stop();
      setIsCycleActive(false);
      return;
    }

    await engine.initContext();
    setIsCycleActive(true);

    await engine.startCycle(
      {
        bpm,
        timeSignature,
        measuresCount,
        referencePitch,
        listeningMode,
      },
      () => {
        setIsCycleActive(false);
      }
    );
  }, [engine, isCycleActive, bpm, timeSignature, measuresCount, referencePitch, listeningMode]);

  // Écoute de la note repère au repos
  const handlePlayReferencePreview = useCallback(async () => {
    if (isCycleActive) return;
    await engine.initContext();
    await engine.playReferencePitchPreview(referencePitch);
  }, [engine, isCycleActive, referencePitch]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      {/* 1. Balancier Cinématique 60 FPS */}
      <PendulumVisualizer
        engine={engine}
        isActive={isCycleActive}
        measuresCount={measuresCount}
        beatsPerMeasure={beatsPerMeasure}
      />

      {/* 2. Bouton d'action principal à structure DOM 100% stable */}
      <button
        type="button"
        onClick={handleToggleCycle}
        className={`w-full py-3 px-6 cordel-btn-primary text-sm tracking-widest uppercase cursor-pointer transition-colors ${
          isCycleActive ? 'bg-red-900 hover:bg-red-800' : ''
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center">
            {isCycleActive ? (
              <Square key="icon-stop" className="w-5 h-5 fill-current" />
            ) : (
              <Play key="icon-play" className="w-5 h-5 fill-current" />
            )}
          </span>
          <span>
            {isCycleActive
              ? 'ARRÊTER LE CYCLE'
              : `LANCER LE CYCLE DE TEST (1 M Élan + ${measuresCount} M Chant)`}
          </span>
        </div>
      </button>

      {/* 3. Sélecteur de Pupitre Sequenciador (Puxador et Coro stricts) */}
      <div className="cordel-card p-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-theme-ink">
          <Sparkles className="w-3.5 h-3.5 text-theme-accent" />
          Pupitre Cible Sequenciador
        </span>
        <div className="flex gap-2">
          {(['puxador', 'coro'] as VocalRoleTarget[]).map((role) => (
            <button
              key={role}
              type="button"
              disabled={isCycleActive}
              onClick={() => setSuggestedRole(role)}
              className={`px-4 py-1.5 text-xs uppercase font-bold transition-all cursor-pointer ${
                suggestedRole === role ? 'cordel-btn-primary' : 'cordel-btn'
              }`}
            >
              {role === 'puxador' ? 'Puxador' : 'Coro'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Sous-panneaux de configuration modulaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricConfigPanel
          timeSignature={timeSignature}
          onTimeSignatureChange={setTimeSignature}
          bpm={bpm}
          onBpmChange={setBpm}
          measuresCount={measuresCount}
          onMeasuresCountChange={setMeasuresCount}
          beatResolutions={beatResolutions}
          onBeatResolutionsChange={setBeatResolutions}
          disabled={isCycleActive}
        />

        <div className="flex flex-col gap-3">
          <ListeningModePanel
            listeningMode={listeningMode}
            onListeningModeChange={setListeningMode}
            referencePitch={referencePitch}
            onReferencePitchChange={setReferencePitch}
            onPlayReferencePreview={handlePlayReferencePreview}
            disabled={isCycleActive}
          />

          <DeviceSelector
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={setSelectedDeviceId}
            disabled={isCycleActive}
          />
        </div>
      </div>
    </div>
  );
};
