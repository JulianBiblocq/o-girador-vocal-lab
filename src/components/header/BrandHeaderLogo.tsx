/**
 * BrandHeaderLogo.tsx
 * Signature visuelle compacte sur 1 ligne : O GIRADOR • CANTADOR (< 40 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export const BrandHeaderLogo: React.FC = () => {
  const { locale } = useLanguage();
  const subtitle = locale === 'br' ? 'Oficina Vocal' : 'Atelier Vocal';

  return (
    <div
      className="inline-flex items-center gap-2 select-none cursor-default shrink-0 leading-none"
      title={`O Girador — Cantador (${subtitle})`}
    >
      <span className="font-cactus text-[var(--cordel-text)] text-base sm:text-lg tracking-wider uppercase leading-none font-bold">
        O GIRADOR
      </span>
      <span className="text-[var(--cordel-secondary-text)] font-mono text-xs hidden xs:inline" aria-hidden="true">•</span>
      <span className="bg-[#9a3412] text-[#fbbf24] border border-[var(--cordel-border)] px-1.5 py-0.5 text-[10px] font-black tracking-[0.2em] uppercase -rotate-1 shadow-[1.5px_1.5px_0px_rgba(0,0,0,0.75)] leading-tight">
        CANTADOR
      </span>
    </div>
  );
};
