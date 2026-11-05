/**
 * CordelAccordion.tsx
 * Composant accordéon générique au style Cordel avec résumé compact (< 75 lignes).
 */
import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CordelAccordionProps {
  title: React.ReactNode;
  summaryBadge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  className?: string;
}

export const CordelAccordion: React.FC<CordelAccordionProps> = ({
  title,
  summaryBadge,
  children,
  defaultOpen = false,
  storageKey,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`cordel_acc_${storageKey}`);
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`cordel_acc_${storageKey}`, String(isOpen));
      } catch {}
    }
  }, [isOpen, storageKey]);

  return (
    <div className={`cordel-card flex flex-col rounded transition-all duration-200 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-2.5 sm:p-3 flex items-center justify-between gap-2.5 text-left cursor-pointer select-none hover:bg-[var(--cordel-border-sub)]/30 rounded transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 font-mono font-bold text-xs sm:text-sm text-theme-ink truncate">
          {title}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isOpen && summaryBadge && (
            <div className="text-[11px] font-mono text-[var(--cordel-secondary-text)] hidden sm:inline-block">
              {summaryBadge}
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 text-theme-accent transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="p-2.5 sm:p-3 pt-0 border-t border-[var(--cordel-border-sub)]/60 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
};
