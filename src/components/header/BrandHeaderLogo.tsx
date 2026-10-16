/**
 * BrandHeaderLogo.tsx
 * Signature visuelle unifiée O GIRADOR avec tampon estampé CANTADOR (< 60 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export const BrandHeaderLogo: React.FC = () => {
  const { locale } = useLanguage();
  const subtitle = locale === 'br' ? 'Oficina Vocal' : 'Atelier Vocal';

  return (
    <div
      className="flex flex-col items-start select-none cursor-default shrink-0 leading-none group"
      title={`O Girador — Cantador (${subtitle})`}
    >
      <span className="font-cactus text-[var(--cordel-text)] text-xl sm:text-2xl tracking-wider uppercase leading-none font-bold">
        O GIRADOR
      </span>
      <div className="flex items-center gap-1.5 mt-0.5 self-start">
        <span className="bg-[#9a3412] text-[#fbbf24] border border-[var(--cordel-border)] px-2 py-0.5 text-[10px] font-black tracking-[0.22em] uppercase -rotate-1 shadow-[2px_2px_0px_rgba(0,0,0,0.8)] leading-tight">
          CANTADOR
        </span>
        <span className="text-[10px] font-mono text-[var(--cordel-text)] opacity-70 hidden md:inline">
          • {subtitle}
        </span>
      </div>
    </div>
  );
};
