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
    <div className="space-y-3 font-mono text-xs">
      <div className="cordel-card-sm p-2.5 rounded flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('two_staves')}
            className={`px-2.5 py-1 rounded font-bold border cursor-pointer ${viewMode === 'two_staves' ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}
          >
            {t('scoreModeTwoStaves')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tab_4e')}
            className={`px-2.5 py-1 rounded font-bold border cursor-pointer ${viewMode === 'tab_4e' ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn'}`}
          >
            {t('scoreModeTab4E')}
          </button>

          {viewMode === 'two_staves' ? (
            <div className="flex items-center gap-1 ml-1">
              <span className="font-bold opacity-80">{t('scoreClefLabel')}</span>
              {([['auto', 'scoreClefAuto'], ['treble', 'scoreClefTreble'], ['treble_8vb', 'scoreClefTreble8vb']] as const).map(([val, key]) => (
                <button key={val} type="button" onClick={() => setClefMode(val)} className={`px-2 py-0.5 rounded font-bold border cursor-pointer ${clefMode === val ? 'bg-theme-wood text-[var(--cordel-on-primary)] border-theme-wood' : 'cordel-btn'}`}>
                  {t(key)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-1">
              <span className="font-bold opacity-80">{t('scoreNotationLabel')}</span>
              {([['letters', 'scoreNotationLetters'], ['solfege', 'scoreNotationSolfege'], ['degrees', 'scoreNotationDegrees']] as const).map(([val, key]) => (
                <button key={val} type="button" onClick={() => setNotation(val)} className={`px-2 py-0.5 rounded font-bold border cursor-pointer ${notation === val ? 'bg-theme-wood text-[var(--cordel-on-primary)] border-theme-wood' : 'cordel-btn'}`}>
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
            className="px-2.5 py-1 rounded bg-[#9a3412] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('scoreBtnPrintPortrait')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportMusicXml}
            className="px-2.5 py-1 rounded bg-[#0f766e] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('scoreBtnExportMusicXml')}</span>
          </button>
        </div>
      </div>

      <div className="rounded border-2 border-[var(--cordel-wood)] bg-stone-200 p-2">
        <iframe
          title={`score-preview-${project.id}`}
          srcDoc={previewHtml}
          className="w-full h-[56vh] bg-white rounded border border-stone-400"
        />
      </div>
    </div>
  );
};
