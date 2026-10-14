import React from 'react';
import { Zap, Hand, X, AlertTriangle } from 'lucide-react';
import type { CalibrationProgress } from '../../audio/clapCalibration';
import { useLanguage } from '../../i18n/LanguageContext';

interface CalibrationFeedbackBoxProps {
  calibState: 'running_ping' | 'running_claps' | 'failed_ping';
  clapProgress: CalibrationProgress;
  onRetryPing: () => void;
  onStartClaps: () => void;
  onCancel: () => void;
}

export const CalibrationFeedbackBox: React.FC<CalibrationFeedbackBoxProps> = ({
  calibState,
  clapProgress,
  onRetryPing,
  onStartClaps,
  onCancel,
}) => {
  const { t } = useLanguage();

  if (calibState === 'running_ping') {
    return (
      <div className="p-2 border border-cyan-500/40 bg-cyan-950/20 flex items-center justify-between">
        <span className="text-[11px] text-cyan-300 font-bold animate-pulse flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{t('calibPingInstruction')}</span>
        </span>
        <span className="text-[10px] text-cyan-400 font-bold tracking-wider">AUTO-PING</span>
      </div>
    );
  }

  if (calibState === 'running_claps') {
    return (
      <div className="p-2 border border-theme-accent/30 bg-theme-accent/10 flex items-center justify-between">
        <span className="text-[11px] text-theme-ink font-bold animate-pulse">
          {clapProgress.step === 'countdown' && t('calibStepListen')}
          {clapProgress.step === 'clapping' && t('calibStepClap', { n: clapProgress.currentBeat ?? 1 })}
          {clapProgress.step === 'analyzing' && t('calibStepCompute')}
        </span>
        <span className="text-[10px] text-theme-accent font-bold">
          {clapProgress.step === 'clapping' ? t('calibClapBadge', { n: clapProgress.currentBeat ?? 1 }) : t('calibAutoTestBadge')}
        </span>
      </div>
    );
  }

  return (
    <div className="p-2 border border-amber-500/50 bg-amber-950/30 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{t('calibPingFailed')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRetryPing}
          className="cordel-btn px-2 py-0.5 rounded-none flex items-center gap-1 text-[10px] font-bold cursor-pointer"
        >
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>{t('calibRetryPing')}</span>
        </button>
        <button
          type="button"
          onClick={onStartClaps}
          className="cordel-btn px-2 py-0.5 rounded-none flex items-center gap-1 text-[10px] font-bold cursor-pointer"
        >
          <Hand className="w-3 h-3 text-amber-400" />
          <span>{t('calibMethodHumanSync')}</span>
        </button>
        <button
          type="button"
          title={t('calibCancelTooltip')}
          onClick={onCancel}
          className="cordel-btn p-0.5 rounded-none text-theme-ink hover:text-red-400 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
