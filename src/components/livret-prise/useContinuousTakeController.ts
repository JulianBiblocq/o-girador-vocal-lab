/**
 * useContinuousTakeController.ts
 * Contrôleur du cycle d'enregistrement continu et auto-découpage des patterns (< 110 lignes).
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from '../../audio/MetronomeEngine';
import type { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { ContinuousTakeSession, type ContinuousPrompterSlotInfo } from '../../audio/continuousTakeRecorder';
import { sliceContinuousTake } from '../../utils/continuousTakeSlicer';
import type { TakeRecordingMode } from './TakeModeSelector';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';

export interface UseContinuousTakeControllerParams {
  project: ToadaProject;
  loadProject: (p: ToadaProject) => void;
  engine: MetronomeEngine;
  recorder: VocalRecorderEngine;
  listeningMode: ListeningMode;
  selectedDeviceId: string;
  selectedOutputDeviceId: string;
  activeLivret: string;
}

export function useContinuousTakeController(params: UseContinuousTakeControllerParams) {
  const { project, loadProject, engine, recorder, listeningMode, selectedDeviceId, selectedOutputDeviceId, activeLivret } = params;
  const [takeMode, setTakeMode] = useState<TakeRecordingMode>('pattern');
  const [isContinuousActive, setIsContinuousActive] = useState(false);
  const [prompterInfo, setPrompterInfo] = useState<ContinuousPrompterSlotInfo | null>(null);

  const sessionRef = useRef<ContinuousTakeSession>(new ContinuousTakeSession());
  const { setIsRecording } = useVocalTransportStore();

  const handleFinishContinuous = useCallback((pcm: Float32Array, sampleRate: number, marginBeforeM0Sec: number) => {
    if (takeMode === 'pattern') return;
    const targetRole = takeMode;
    const { updatedPatterns, processedCount } = sliceContinuousTake(project, targetRole, pcm, sampleRate, marginBeforeM0Sec);

    loadProject({ ...project, patterns: updatedPatterns });
    setIsContinuousActive(false);
    setPrompterInfo(null);

    const roleLabel = targetRole === 'puxador' ? 'Puxador' : 'Coro';
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `Prise continue ${roleLabel} : ${processedCount} patterns découpés et calés !`, type: 'success' },
    }));
  }, [takeMode, project, loadProject]);

  const handleToggleContinuous = useCallback(async () => {
    if (takeMode === 'pattern') return;
    if (isContinuousActive) {
      const pcm = sessionRef.current.stop(recorder, engine);
      if (pcm && pcm.length > 0) {
        handleFinishContinuous(pcm, recorder ? 44100 : 44100, 0.6);
      } else {
        setIsContinuousActive(false);
        setPrompterInfo(null);
      }
      return;
    }

    setIsContinuousActive(true);
    await sessionRef.current.start({
      project,
      targetRole: takeMode,
      engine,
      recorder,
      listeningMode,
      selectedDeviceId,
      selectedOutputDeviceId,
      onPrompterUpdate: (info) => setPrompterInfo(info),
      onComplete: (pcm, sr, margin) => handleFinishContinuous(pcm, sr, margin),
    });
  }, [takeMode, isContinuousActive, project, engine, recorder, listeningMode, selectedDeviceId, selectedOutputDeviceId, handleFinishContinuous]);

  useEffect(() => {
    if (isContinuousActive) setIsRecording(true);
    if (activeLivret !== 'prise' && isContinuousActive) {
      sessionRef.current.stop(recorder, engine);
      setIsContinuousActive(false);
      setPrompterInfo(null);
    }
  }, [activeLivret, isContinuousActive, engine, recorder, setIsRecording]);

  return {
    takeMode,
    setTakeMode,
    isContinuousActive,
    prompterInfo,
    handleToggleContinuous,
  };
}
