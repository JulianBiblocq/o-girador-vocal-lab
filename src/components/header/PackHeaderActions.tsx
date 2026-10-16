import React, { useRef } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { parseToadaPack } from '../../utils/toadaPackLoader';
import { downloadToadaPackJson } from '../../utils/toadaPackExporter';
import { alertAsync } from '../../stores/useCordelDialogStore';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { ToadaLibraryDropdown } from './ToadaLibraryDropdown';
import { MidiConnectionBadge } from './MidiConnectionBadge';
import { FolderOpen, Download } from 'lucide-react';

export const PackHeaderActions: React.FC = () => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const restored = parseToadaPack(text);
        loadProject(restored);
      } catch (err) {
        console.error('[PackHeaderActions] Erreur chargement pack :', err);
        await alertAsync({
          title: t('dialogAlertTitle'),
          message: t('packLoadError'),
          confirmLabel: t('dialogOk'),
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportClick = () => {
    downloadToadaPackJson(project);
  };

  return (
    <div className="flex items-center gap-2">
      <MidiConnectionBadge />
      <ToadaLibraryDropdown />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      {viewRoleMode !== 'eleve' && (
        <>
          <button
            type="button"
            onClick={handleOpenClick}
            title={t('openPackTooltip')}
            className="h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-theme-ink transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-theme-accent" />
            <span className="hidden sm:inline">{t('openPack')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportClick}
            title={t('exportPackTooltip')}
            className="h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-theme-wood hover:bg-theme-wood/90 !text-[#f4ecd8] text-[var(--cordel-on-primary)] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 !text-[#f4ecd8] text-[var(--cordel-on-primary)]" />
            <span className="hidden sm:inline !text-[#f4ecd8] text-[var(--cordel-on-primary)]">{t('exportPack')}</span>
          </button>
        </>
      )}
    </div>
  );
};

