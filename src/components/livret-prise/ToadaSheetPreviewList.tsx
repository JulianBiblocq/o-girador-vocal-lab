/**
 * ToadaSheetPreviewList.tsx
 * Tableau Cordel de prévisualisation des phrases analysées (< 75 lignes).
 */
import React from 'react';
import type { ParsedLyricsSegment } from '../../types/toadaDocument.types';
import { useLanguage } from '../../i18n/LanguageContext';

interface ToadaSheetPreviewListProps {
  segments: ParsedLyricsSegment[];
}

export const ToadaSheetPreviewList: React.FC<ToadaSheetPreviewListProps> = ({ segments }) => {
  const { t } = useLanguage();

  if (segments.length === 0) {
    return (
      <div className="border border-dashed border-[var(--cordel-border)]/60 p-4 text-center text-xs font-mono text-stone-500 italic">
        {t('toadaSheetNoPhrases')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto cordel-scrollbar pr-1">
      {segments.map((seg, idx) => {
        const isPuxador = seg.role === 'puxador';
        return (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-1.5 bg-black/40 border border-[var(--cordel-border)]/50 text-xs font-mono rounded-none"
          >
            <span className="text-[10px] text-stone-500 font-bold w-5 shrink-0 pt-0.5">
              #{idx + 1}
            </span>
            <span
              className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shrink-0 rounded-none ${
                isPuxador ? 'bg-role-puxador text-[#f4ecd8]' : 'bg-role-coro text-[#f4ecd8]'
              }`}
            >
              {isPuxador ? t('rolePuxador') : t('roleCoro')}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-stone-200 break-words">{seg.text}</span>
              {seg.phoneticText && (
                <span className="text-[10px] text-stone-400 italic break-words mt-0.5">
                  🔤 {seg.phoneticText}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
