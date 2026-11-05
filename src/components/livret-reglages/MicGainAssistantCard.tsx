/**
 * MicGainAssistantCard.tsx
 * Assistant de Gain Micro en 3 Secondes (< 125 lignes) :
 * - Classification pure du niveau de crête en dBFS (too_hot > -1 dB, optimal [-18, -1] dB, too_low < -18 dB)
 * - Composant interactif de test vocal 3s dans ⚙️ Réglages.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, CheckCircle2, AlertTriangle, Volume2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/i18n.types';

export type MicGainDiagnosticStatus = 'too_hot' | 'optimal' | 'too_low';
export interface MicGainDiagnosticResult {
  status: MicGainDiagnosticStatus;
  peakDb: number;
  rmsDb: number;
  titleKey: TranslationKey;
  adviceKey: TranslationKey;
}

export function sampleToDbFs(absSample: number): number {
  return absSample <= 0.00001 ? -96.0 : Math.round(20 * Math.log10(absSample) * 10) / 10;
}

export function classifyMicGainLevel(peakDb: number, rmsDb = -24): MicGainDiagnosticResult {
  const roundedPeak = Math.round(peakDb * 10) / 10;
  const roundedRms = Math.round(rmsDb * 10) / 10;
  if (roundedPeak > -1.0) {
    return { status: 'too_hot', peakDb: roundedPeak, rmsDb: roundedRms, titleKey: 'gainDiagTooHotTitle', adviceKey: 'gainDiagTooHotAdvice' };
  }
  if (roundedPeak >= -18.0) {
    return { status: 'optimal', peakDb: roundedPeak, rmsDb: roundedRms, titleKey: 'gainDiagOptimalTitle', adviceKey: 'gainDiagOptimalAdvice' };
  }
  return { status: 'too_low', peakDb: roundedPeak, rmsDb: roundedRms, titleKey: 'gainDiagTooLowTitle', adviceKey: 'gainDiagTooLowAdvice' };
}

export const MicGainAssistantCard: React.FC<{ selectedDeviceId?: string }> = ({ selectedDeviceId }) => {
  const { t } = useLanguage();
  const [isTesting, setIsTesting] = useState(false);
  const [livePeakDb, setLivePeakDb] = useState<number>(-60);
  const [result, setResult] = useState<MicGainDiagnosticResult | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const stopTest = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsTesting(false);
  }, []);
  useEffect(() => () => stopTest(), [stopTest]);

  const startThreeSecondTest = async () => {
    if (isTesting) { stopTest(); return; }
    setResult(null); setLivePeakDb(-60); setIsTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedDeviceId && selectedDeviceId !== 'default' ? { deviceId: { exact: selectedDeviceId } } : {}),
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        },
      });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let maxAbs = 0.0001, sumSq = 0, count = 0, animId = 0;
      const cleanup = () => {
        cancelAnimationFrame(animId);
        stream.getTracks().forEach((tr) => tr.stop());
        src.disconnect();
        ctx.close().catch(() => {});
      };
      abortRef.current = cleanup;
      const startMs = performance.now();
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) {
          const a = Math.abs(buf[i]);
          if (a > maxAbs) maxAbs = a;
          sumSq += a * a; count++;
        }
        setLivePeakDb(sampleToDbFs(maxAbs));
        if (performance.now() - startMs < 3000) {
          animId = requestAnimationFrame(tick);
        } else {
          cleanup(); abortRef.current = null; setIsTesting(false);
          const rms = count > 0 ? Math.sqrt(sumSq / count) : 0.0001;
          setResult(classifyMicGainLevel(sampleToDbFs(maxAbs), sampleToDbFs(rms)));
        }
      };
      animId = requestAnimationFrame(tick);
    } catch {
      setIsTesting(false);
    }
  };

  return (
    <div className="cordel-card p-3 flex flex-col gap-2 rounded text-xs font-mono">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-theme-ink flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-theme-accent" /><span>{t('gainAssistantTitle')}</span>
        </span>
        <button
          type="button" onClick={startThreeSecondTest}
          className={`px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer ${isTesting ? 'bg-red-700 text-white animate-pulse' : 'cordel-btn-primary'}`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{isTesting ? t('gainAssistantTestingPrompt', { db: livePeakDb.toFixed(1) }) : t('gainAssistantStartBtn')}</span>
        </button>
      </div>
      {result && (
        <div className={`p-2 rounded border flex flex-col gap-1 ${result.status === 'too_hot' ? 'border-red-600/60 bg-red-500/15 text-red-900 dark:text-red-200' : result.status === 'optimal' ? 'border-emerald-600/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200' : 'border-amber-600/60 bg-amber-500/15 text-amber-900 dark:text-amber-200'}`}>
          <div className="font-bold flex items-center gap-1.5">
            {result.status === 'optimal' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{t(result.titleKey, { db: result.peakDb.toFixed(1) })}</span>
          </div>
          <p className="text-[11px] opacity-90 m-0">{t(result.adviceKey)}</p>
        </div>
      )}
    </div>
  );
};
