import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { runClapCalibration, type CalibrationProgress } from '../../audio/clapCalibration';
import { buildDeviceSignature, getCalibratedLatency, saveCalibratedLatency } from '../../utils/deviceSignature';
import { useLanguage } from '../../i18n/LanguageContext';

interface CalibrationBannerProps {
  inputDeviceId: string;
  outputDeviceId: string;
  sampleRate: number;
  onCalibrationComplete: (offsetMs: number) => void;
  disabled?: boolean;
}

export const CalibrationBanner: React.FC<CalibrationBannerProps> = ({
  inputDeviceId,
  outputDeviceId,
  sampleRate,
  onCalibrationComplete,
  disabled = false,
}) => {
  const { locale } = useLanguage();
  const isPt = locale === 'pt';
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState<CalibrationProgress>({ step: 'idle' });
  const [calibratedLatency, setCalibratedLatency] = useState<number | null>(null);

  const sig = buildDeviceSignature(inputDeviceId, outputDeviceId, sampleRate);

  useEffect(() => {
    setCalibratedLatency(getCalibratedLatency(sig));
    setProgress({ step: 'idle' });
  }, [sig]);

  const handleStartCalibration = async () => {
    setIsCalibrating(true);
    setProgress({ step: 'countdown', currentBeat: 1 });
    try {
      const result = await runClapCalibration(inputDeviceId, outputDeviceId, sig, (p: CalibrationProgress) => setProgress(p));
      if (result !== null) {
        setCalibratedLatency(result);
        saveCalibratedLatency(sig, result);
        onCalibrationComplete(result);
      }
    } catch (err) {
      console.warn('Erreur de calibration:', err);
    } finally {
      setIsCalibrating(false);
    }
  };

  const statusLabel = calibratedLatency !== null
    ? (isPt ? `Aparelho calibrado (${calibratedLatency > 0 ? '+' : ''}${calibratedLatency} ms)` : `Appareil calibré (${calibratedLatency > 0 ? '+' : ''}${calibratedLatency} ms)`)
    : (isPt ? 'Novo aparelho de áudio detectado — CALIBRAR EM 8 PALMAS' : 'Nouvel appareil audio détecté — CALIBRER EN 8 CLAPS');

  const btnLabel = calibratedLatency !== null
    ? (isPt ? 'Recalibrar (8 palmas)' : 'Recalibrer (8 claps)')
    : (isPt ? 'CALIBRAR EM 8 PALMAS' : 'CALIBRER EN 8 CLAPS');

  return (
    <div className="cordel-card p-2.5 bg-black/40 text-xs font-mono flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {calibratedLatency !== null ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{statusLabel}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{statusLabel}</span>
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
          <span>{btnLabel}</span>
        </button>
      </div>

      {isCalibrating && (
        <div className="p-2 border border-theme-accent/30 bg-theme-accent/10 flex items-center justify-between">
          <span className="text-[11px] text-theme-ink font-bold animate-pulse">
            {progress.step === 'countdown' && (isPt ? 'Escute o andamento (4 pulsos)...' : 'Écoutez le tempo (4 bips)...')}
            {progress.step === 'clapping' && (isPt ? `Bata palmas em cada pulso (${progress.currentBeat ?? 1}/8)!` : `Tapez dans vos mains sur chaque bip (${progress.currentBeat ?? 1}/8) !`)}
            {progress.step === 'analyzing' && (isPt ? 'Calculando latência...' : 'Calcul de la latence...')}
          </span>
          <span className="text-[10px] text-theme-accent font-bold">
            {progress.step === 'clapping' ? (isPt ? `PALMA ${progress.currentBeat}/8` : `CLAP ${progress.currentBeat}/8`) : 'AUTO-TEST'}
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
