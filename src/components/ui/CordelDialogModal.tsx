/**
 * CordelDialogModal.tsx
 * Modale de dialogue universelle Cordel / Xilogravura avec téléportation souveraine (< 115 lignes).
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { useCordelDialogStore } from '../../stores/useCordelDialogStore';
import { useLanguage } from '../../i18n/LanguageContext';

export const CordelDialogModal: React.FC = () => {
  const { isOpen, type, options, close } = useCordelDialogStore();
  const { t } = useLanguage();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const title = options.title || (type === 'confirm' ? t('dialogConfirmTitle') : t('dialogAlertTitle'));
  const confirmLabel = options.confirmLabel || (type === 'confirm' ? t('dialogConfirm') : t('dialogOk'));
  const cancelLabel = options.cancelLabel || t('dialogCancel');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => close(false)}
      className="fixed inset-0 z-[100050] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cordel-card text-theme-ink border border-[var(--cordel-border-panel)] rounded shadow-xl max-w-md w-full p-5 flex flex-col gap-4 font-mono animate-in zoom-in-95 duration-100"
      >
        {/* En-tête Cordel Gravé */}
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-[var(--cordel-border-sub)]">
          {type === 'confirm' ? (
            options.variant === 'danger' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <HelpCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
            )
          ) : (
            <Info className="w-5 h-5 text-theme-ink shrink-0" />
          )}
          <h2 className="text-sm font-black uppercase tracking-wider text-theme-ink m-0">
            {title}
          </h2>
        </div>

        {/* Message du Dialogue */}
        <div className="text-xs leading-relaxed text-theme-ink/90 font-medium">
          {options.message}
        </div>

        {/* Boutons d'Action Cordel */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--cordel-border-sub)]">
          {type === 'confirm' && (
            <button
              type="button"
              onClick={() => close(false)}
              className="cordel-btn px-4 py-1.5 text-xs font-bold uppercase rounded cursor-pointer"
            >
              [ ✕ {cancelLabel} ]
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            autoFocus
            onClick={() => close(true)}
            className="cordel-btn-primary px-5 py-1.5 text-xs font-bold uppercase rounded cursor-pointer"
          >
            [ ✓ {confirmLabel} ]
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
