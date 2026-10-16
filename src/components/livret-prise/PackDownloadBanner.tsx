/**
 * PackDownloadBanner.tsx
 * Banniere de telechargement du Pack Toada multi-declinaisons & multi-patterns.
 */
import React from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import type { VocalPackExport } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { downloadToadaPackJson } from '../../utils/toadaPackExporter';

interface PackDownloadBannerProps {
  exportedPack: VocalPackExport;
}

export const PackDownloadBanner: React.FC<PackDownloadBannerProps> = ({ exportedPack }) => {
  const { project } = useToadaProject();
  const { t } = useLanguage();

  const handleDownloadLegacy = () => {
    const blob = new Blob([JSON.stringify(exportedPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocalPack_${exportedPack.metadata.timeSignature.replace('/', '-')}_${exportedPack.metadata.bpm}bpm.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadToada = () => {
    downloadToadaPackJson(project, exportedPack);
  };

  return (
    <div className="cordel-card p-3 flex flex-wrap items-center justify-between gap-2 bg-black/40 border-2 border-emerald-500 rounded-none">
      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>{t('export_toada_pack_success')}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={handleDownloadToada}
          className="cordel-btn-primary py-1 px-3 flex items-center gap-1.5 text-xs font-bold rounded-none cursor-pointer !text-[#f4ecd8] text-[var(--cordel-on-primary)]"
        >
          <Download className="w-3.5 h-3.5 !text-[#f4ecd8] text-[var(--cordel-on-primary)]" />
          <span className="!text-[#f4ecd8] text-[var(--cordel-on-primary)]">{t('export_toada_pack')}</span>
        </button>
        <button
          type="button" onClick={handleDownloadLegacy}
          className="cordel-btn-secondary py-1 px-2.5 flex items-center gap-1 text-[11px] rounded-none cursor-pointer text-stone-300"
          title="Export Pattern v1.0"
        >
          <span>v1.0</span>
        </button>
      </div>
    </div>
  );
};
