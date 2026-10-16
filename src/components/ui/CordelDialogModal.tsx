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
        className="bg-[#f4ecd8] text-[#1a1a1a] border-2 border-[#1a1a1a] rounded-none shadow-[6px_6px_0px_#1a1a1a] max-w-md w-full p-5 flex flex-col gap-4 font-mono animate-in zoom-in-95 duration-100"
      >
        {/* En-tête Cordel Gravé */}
        <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-[#1a1a1a]">
          {type === 'confirm' ? (
            options.variant === 'danger' ? (
              <AlertTriangle className="w-5 h-5 text-[#8b2a1a] shrink-0" />
            ) : (
              <HelpCircle className="w-5 h-5 text-[#8b2a1a] shrink-0" />
            )
          ) : (
            <Info className="w-5 h-5 text-[#1a1a1a] shrink-0" />
          )}
          <h2 className="text-sm font-black uppercase tracking-wider text-[#1a1a1a] m-0">
            {title}
          </h2>
        </div>

        {/* Message du Dialogue */}
        <div className="text-xs leading-relaxed text-[#1a1a1a]/90 font-medium">
          {options.message}
        </div>

        {/* Boutons d'Action Cordel */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1a1a1a]/20">
          {type === 'confirm' && (
            <button
              type="button"
              onClick={() => close(false)}
              className="bg-[#f4ecd8] text-[#1a1a1a] hover:bg-[#e2d5b8] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] px-4 py-1.5 text-xs font-bold uppercase rounded-none transition-all cursor-pointer"
            >
              [ ✕ {cancelLabel} ]
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            autoFocus
            onClick={() => close(true)}
            className="bg-[#8b2a1a] text-[#f4ecd8] hover:bg-[#6b1f13] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] px-5 py-1.5 text-xs font-bold uppercase rounded-none transition-all cursor-pointer"
          >
            [ ✓ {confirmLabel} ]
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
