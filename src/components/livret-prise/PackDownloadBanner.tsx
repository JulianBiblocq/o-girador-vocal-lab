import React from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import type { VocalPackExport } from '../../types/vocalPack.types';

interface PackDownloadBannerProps {
  exportedPack: VocalPackExport;
}

export const PackDownloadBanner: React.FC<PackDownloadBannerProps> = ({ exportedPack }) => {
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportedPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocalPack_${exportedPack.metadata.timeSignature.replace('/', '-')}_${exportedPack.metadata.bpm}bpm.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cordel-card p-3 flex items-center justify-between bg-black/40 border-2 border-emerald-500">
      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>Pack Universel v1.0 prêt pour Sequenciador !</span>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="cordel-btn-primary py-1 px-3 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Télécharger JSON</span>
      </button>
    </div>
  );
};
