import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Zap, Hand, X } from 'lucide-react';
import { runClapCalibration, type CalibrationProgress } from '../../audio/clapCalibration';
import { runAcousticPingCalibration } from '../../audio/pingCalibration';
import { buildDeviceSignature, getCalibratedLatency, saveCalibratedLatency } from '../../utils/deviceSignature';
import { useLanguage } from '../../i18n/LanguageContext';
import { CalibrationFeedbackBox } from './CalibrationFeedbackBox';

interface CalibrationBannerProps {
  inputDeviceId: string; outputDeviceId: string; sampleRate: number;
  onCalibrationComplete: (offsetMs: number) => void; disabled?: boolean;
}
type CalibState = 'idle' | 'choosing' | 'running_ping' | 'running_claps' | 'failed_ping';

export const CalibrationBanner: React.FC<CalibrationBannerProps> = ({
  inputDeviceId, outputDeviceId, sampleRate, onCalibrationComplete, disabled = false,
}) => {
  const { t } = useLanguage();
  const [calibState, setCalibState] = useState<CalibState>('idle');
  const [clapProgress, setClapProgress] = useState<CalibrationProgress>({ step: 'idle' });
  const [calibratedLatency, setCalibratedLatency] = useState<number | null>(null);
  const sig = buildDeviceSignature(inputDeviceId, outputDeviceId, sampleRate);

  useEffect(() => {
    setCalibratedLatency(getCalibratedLatency(sig));
    setCalibState('idle');
  }, [sig]);

  const handleStartPing = async () => {
    setCalibState('running_ping');
    try {
      const result = await runAcousticPingCalibration(inputDeviceId, outputDeviceId, sig);
      if (result !== null) {
        setCalibratedLatency(result);
        onCalibrationComplete(result);
        setCalibState('idle');
      } else {
        setCalibState('failed_ping');
      }
    } catch (err) {
      console.warn('Erreur Auto-Ping:', err);
      setCalibState('failed_ping');
    }
  };

  const handleStartClaps = async () => {
    setCalibState('running_claps');
    setClapProgress({ step: 'countdown', currentBeat: 1 });
    try {
      const result = await runClapCalibration(inputDeviceId, outputDeviceId, sig, setClapProgress);
      if (result !== null) {
        setCalibratedLatency(result);
        saveCalibratedLatency(sig, result);
        onCalibrationComplete(result);
      }
    } catch (err) {
      console.warn('Erreur Clap Calibration:', err);
    } finally {
      setCalibState('idle');
    }
  };

  const isBusy = calibState === 'running_ping' || calibState === 'running_claps';

  return (
    <div className="cordel-card p-2.5 bg-black/40 text-xs font-mono flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {calibratedLatency !== null ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t('calibReadyBadge', { ms: (calibratedLatency > 0 ? '+' : '') + calibratedLatency })}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('calibNewDeviceWarn')}</span>
            </span>
          )}
        </div>

        {calibState === 'idle' && (
          <button
            type="button" disabled={disabled} onClick={() => setCalibState('choosing')}
            className="cordel-btn px-2.5 py-1 rounded-none flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-theme-accent" />
            <span>{calibratedLatency !== null ? t('calibBtnRecalibrate') : t('calibBtnFirstTime')}</span>
          </button>
        )}

        {calibState === 'choosing' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button" title={t('calibAutoPingTooltip')} onClick={handleStartPing}
              className="cordel-btn px-2.5 py-1 rounded-none flex items-center gap-1.5 text-[11px] font-bold cursor-pointer border-cyan-500/50 hover:bg-cyan-950/40"
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>{t('calibMethodAutoPing')}</span>
            </button>
            <button
              type="button" title={t('calibHumanSyncTooltip')} onClick={handleStartClaps}
              className="cordel-btn px-2.5 py-1 rounded-none flex items-center gap-1.5 text-[11px] font-bold cursor-pointer border-amber-500/50 hover:bg-amber-950/40"
            >
              <Hand className="w-3 h-3 text-amber-400" />
              <span>{t('calibMethodHumanSync')}</span>
            </button>
            <button
              type="button" title={t('calibCancelTooltip')} onClick={() => setCalibState('idle')}
              className="cordel-btn p-1 rounded-none text-theme-ink hover:text-red-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isBusy && (
          <div className="flex items-center gap-1.5 text-[11px] text-theme-accent font-bold">
            <RefreshCw className="w-3 h-3 animate-spin" />
          </div>
        )}
      </div>

      {(calibState === 'running_ping' || calibState === 'running_claps' || calibState === 'failed_ping') && (
        <CalibrationFeedbackBox
          calibState={calibState} clapProgress={clapProgress}
          onRetryPing={handleStartPing} onStartClaps={handleStartClaps}
          onCancel={() => setCalibState('idle')}
        />
      )}
    </div>
  );
};
