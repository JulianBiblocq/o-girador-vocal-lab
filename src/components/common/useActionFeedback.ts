/**
 * useActionFeedback.ts
 * Hook réutilisable de retour visuel systématique (idle -> loading -> success ✓ pendant 2500 ms)
 * conforme à la Charte Cordel Pure (vert canard #0f766e, texte #f4ecd8, zéro emoji 3D) (< 75 lignes).
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export type ActionFeedbackStatus = 'idle' | 'loading' | 'success';

export interface UseActionFeedbackResult {
  status: ActionFeedbackStatus;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  successLabel: string;
  trigger: (
    action: () => Promise<string | void> | string | void,
    customSuccessLabel?: string
  ) => Promise<void>;
  getButtonClass: (baseClass: string, loadingClass?: string) => string;
}

export const CORDEL_SUCCESS_BTN_CLASS =
  '!bg-[#0f766e] !text-[#f4ecd8] !border-[#14b8a6] font-bold shadow-sm transition-colors';

export function useActionFeedback(defaultSuccessLabel = '✓ Fait !', durationMs = 2500): UseActionFeedbackResult {
  const [status, setStatus] = useState<ActionFeedbackStatus>('idle');
  const [successLabel, setSuccessLabel] = useState<string>(defaultSuccessLabel);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(
    async (
      action: () => Promise<string | void> | string | void,
      customSuccessLabel?: string
    ) => {
      if (status === 'loading') return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus('loading');
      try {
        const res = await action();
        const finalLabel =
          typeof res === 'string' && res.trim().length > 0
            ? res
            : customSuccessLabel || defaultSuccessLabel;
        setSuccessLabel(finalLabel.startsWith('✓') ? finalLabel : `✓ ${finalLabel}`);
        setStatus('success');
        timerRef.current = setTimeout(() => {
          setStatus('idle');
        }, durationMs);
      } catch (err) {
        setStatus('idle');
        throw err;
      }
    },
    [status, defaultSuccessLabel, durationMs]
  );

  const getButtonClass = useCallback(
    (baseClass: string, loadingClass = 'opacity-70 cursor-wait') => {
      if (status === 'success') return `${baseClass} ${CORDEL_SUCCESS_BTN_CLASS}`;
      if (status === 'loading') return `${baseClass} ${loadingClass}`;
      return baseClass;
    },
    [status]
  );

  return {
    status,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    successLabel,
    trigger,
    getButtonClass,
  };
}
