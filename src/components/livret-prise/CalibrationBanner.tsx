import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { buildDeviceSignature, getCalibratedLatency } from '../../utils/deviceSignature';
import { runClapCalibration, type CalibrationProgress } from '../../audio/clapCalibration';

interface CalibrationBannerProps {
  inputDeviceId: string;
  outputDeviceId: string;
  sampleRate: number;
  onCalibrationComplete: (calibratedMs: number) => void;
  disabled?: boolean;
}

export const CalibrationBanner: React.FC<CalibrationBannerProps> = ({
  inputDeviceId, outputDeviceId, sampleRate, onCalibrationComplete, disabled = false,
}) => {
  const [calibratedLatency, setCalibratedLatency] = useState<number | null>(null);
  const [progress, setProgress] = useState<CalibrationProgress>({ step: 'idle' });
  const [isCalibrating, setIsCalibrating] = useState(false);

  const sig = buildDeviceSignature(inputDeviceId, outputDeviceId, sampleRate);

  useEffect(() => {
    setCalibratedLatency(getCalibratedLatency(sig));
    setProgress({ step: 'idle' });
  }, [sig]);

  const handleStartCalibration = async () => {
    setIsCalibrating(true);
    setProgress({ step: 'countdown', currentBeat: 1 });
    try {
      const result = await runClapCalibration(inputDeviceId, outputDeviceId, sig, (p) => setProgress(p));
      if (result !== null) {
        setCalibratedLatency(result);
        onCalibrationComplete(result);
      }
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div className="cordel-card p-2.5 bg-black/40 text-xs font-mono flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {calibratedLatency !== null ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Appareil calibre ({calibratedLatency > 0 ? '+' : ''}{calibratedLatency} ms)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Nouvel appareil audio detecte</span>
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={disabled || isCalibrating}
          onClick={handleStartCalibration}
          className="cordel-btn px-2 py-0.5 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
        >
          {isCalibrating ? (
            <RefreshCw className="w-3 h-3 animate-spin text-theme-accent" />
          ) : (
            <Sparkles className="w-3 h-3 text-theme-accent" />
          )}
          <span>{calibratedLatency !== null ? 'Recalibrer (8 claps)' : 'CALIBRER EN 8 CLAPS'}</span>
        </button>
      </div>

      {isCalibrating && (
        <div className="p-2 border border-theme-accent/30 bg-theme-accent/10 flex items-center justify-between">
          <span className="text-[11px] text-theme-ink font-bold animate-pulse">
            {progress.step === 'countdown' && `Preparez-vous : Ecoutez les bips (${progress.currentBeat ?? 1} / 4)...`}
            {progress.step === 'clapping' && `Clap ! Tapez dans vos mains (${progress.currentBeat ?? 1} / 8)...`}
            {progress.step === 'analyzing' && 'Calcul de la latence materielle...'}
          </span>
          <span className="text-[10px] text-theme-accent font-bold">
            {progress.step === 'clapping' ? `CLAP ${progress.currentBeat}/8` : 'AUTO-TEST'}
          </span>
        </div>
      )}

      {progress.step === 'failed' && (
        <div className="text-[11px] text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          <span>{progress.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
