/**
 * VocalScoreAndMusicXmlTab.tsx
 * Onglet « Partitions & MuseScore » dans Cantador : aperçu & impression A4 Portrait 100 % N&B
 * (Partition 2 Portées Puxador/Coro ou Tablature 4 Étages remplie) et export `.musicxml` (< 120 lignes).
 */
import React, { useState, useMemo } from 'react';
import { Printer, Download } from 'lucide-react';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { useLanguage } from '../../../i18n/LanguageContext';
import { renderTwoStaffScoreSvgPages } from '../../../utils/vocal-score/twoStaffSvgRenderer';
import { renderFilledVocalTabPortraitHTML } from '../../../utils/vocal-score/filledVocalTabRenderer';
import { exportTwoStaffMusicXml, triggerMusicXmlDownload } from '../../../utils/vocal-score/musicXmlTwoStaffExporter';
import type { ClefModeOption, TabPitchNotation } from '../../../utils/vocal-score/scoreTheoryHelper';
import { printViaInvisibleIframe } from '../../../utils/vocal-paper/vocalPaperPrintHelper';

export interface VocalScoreAndMusicXmlTabProps {
  project: ToadaProject;
}

const PILL_IDLE = 'select-none border-[#bfa98a] dark:border-[#4a392d] bg-[#faf5e8] dark:bg-[#16120e] text-[#1c1613] dark:text-[#cbbba0] hover:bg-[#e5d5b5] dark:hover:bg-[#2a1f18]';
const PILL_ACTIVE = 'select-none bg-[#9a3412] dark:bg-[#c2410c] text-white border-[#9a3412] dark:border-[#c2410c]';

export const VocalScoreAndMusicXmlTab: React.FC<VocalScoreAndMusicXmlTabProps> = ({ project }) => {
  const { t, language } = useLanguage();
  const [viewMode, setViewMode] = useState<'two_staves' | 'tab_4e'>('two_staves');
  const [clefMode, setClefMode] = useState<ClefModeOption>('auto');
  const [notation, setNotation] = useState<TabPitchNotation>('letters');

  const previewHtml = useMemo(() => {
    if (viewMode === 'tab_4e') {
      return renderFilledVocalTabPortraitHTML(project, {
        notation,
        lang: language === 'br' ? 'br' : 'fr',
      }).html;
    }
    return renderTwoStaffScoreSvgPages(project, { clefMode }).fullHtml;
  }, [project, viewMode, clefMode, notation, language]);

  const handleExportMusicXml = () => {
    const xml = exportTwoStaffMusicXml(project, { clefMode });
    triggerMusicXmlDownload(xml, project.title || 'toada');
    window.dispatchEvent(
      new CustomEvent('app-toast', { detail: { type: 'success', message: t('scoreMusicXmlExportedToast') } })
    );
  };

  return (
    <div className="space-y-3 font-mono text-xs select-none">
      <div className="p-2.5 rounded border border-[#9a3412]/30 dark:border-[#4a392d] bg-[#efe6d0] dark:bg-[#211a15] text-[#1c1613] dark:text-[#f5ebd6] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setViewMode('two_staves')} className={`px-2.5 py-1 rounded font-bold border cursor-pointer transition-colors ${viewMode === 'two_staves' ? PILL_ACTIVE : PILL_IDLE}`}>
            {t('scoreModeTwoStaves')}
          </button>
          <button type="button" onClick={() => setViewMode('tab_4e')} className={`px-2.5 py-1 rounded font-bold border cursor-pointer transition-colors ${viewMode === 'tab_4e' ? PILL_ACTIVE : PILL_IDLE}`}>
            {t('scoreModeTab4E')}
          </button>

          {viewMode === 'two_staves' ? (
            <div className="flex items-center gap-1 ml-1">
              <span className="font-bold text-[#4a3b31] dark:text-[#cbbba0]">{t('scoreClefLabel')}</span>
              {([['auto', 'scoreClefAuto'], ['treble', 'scoreClefTreble'], ['treble_8vb', 'scoreClefTreble8vb']] as const).map(([val, key]) => (
                <button key={val} type="button" onClick={() => setClefMode(val)} className={`px-2 py-0.5 rounded font-bold border cursor-pointer transition-colors ${clefMode === val ? PILL_ACTIVE : PILL_IDLE}`}>
                  {t(key)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-1">
              <span className="font-bold text-[#4a3b31] dark:text-[#cbbba0]">{t('scoreNotationLabel')}</span>
              {([['letters', 'scoreNotationLetters'], ['solfege', 'scoreNotationSolfege'], ['degrees', 'scoreNotationDegrees']] as const).map(([val, key]) => (
                <button key={val} type="button" onClick={() => setNotation(val)} className={`px-2 py-0.5 rounded font-bold border cursor-pointer transition-colors ${notation === val ? PILL_ACTIVE : PILL_IDLE}`}>
                  {t(key)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => printViaInvisibleIframe(previewHtml, project.title || 'Partition A4')}
            className="px-2.5 py-1 rounded bg-[#9a3412] hover:bg-[#7c2d12] dark:bg-[#c2410c] dark:hover:bg-[#ea580c] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('scoreBtnPrintPortrait')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportMusicXml}
            className="px-2.5 py-1 rounded bg-[#0f766e] hover:bg-[#115e59] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('scoreBtnExportMusicXml')}</span>
          </button>
        </div>
      </div>

      <div className="rounded border-2 border-[#9a3412]/50 dark:border-[#5c4333] bg-[#e5dac3] dark:bg-[#1b1511] p-2">
        <iframe
          title={`score-preview-${project.id}`}
          srcDoc={previewHtml}
          className="w-full h-[56vh] bg-white text-black rounded border border-stone-400"
        />
      </div>
    </div>
  );
};
