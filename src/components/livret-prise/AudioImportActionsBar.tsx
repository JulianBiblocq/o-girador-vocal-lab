/**
 * AudioImportActionsBar.tsx
 * Boutons d'import audio direct de pattern et d'ouverture du Banc de Decoupe (< 70 lignes).
 */
import React, { useRef } from 'react';
import { Upload, Scissors } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AudioImportActionsBarProps {
  disabled?: boolean;
  onOpenSlicerModal: () => void;
  onDirectImportAudio: (file: File) => void;
}

export const AudioImportActionsBar: React.FC<AudioImportActionsBarProps> = ({
  disabled,
  onOpenSlicerModal,
  onDirectImportAudio,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDirectImportAudio(file);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full flex flex-wrap items-center gap-2 text-xs font-mono select-none">
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="flex-1 py-2 px-3 cordel-card-sm flex items-center justify-center gap-1.5 font-bold cursor-pointer hover:bg-stone-900/40 text-theme-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Charger un fichier audio court (.wav, .mp3) directement dans ce pattern"
      >
        <Upload className="w-3.5 h-3.5 text-theme-accent" />
        <span>{t('importAudioPatternBtn')}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onOpenSlicerModal}
        className="flex-1 py-2 px-3 cordel-card-sm flex items-center justify-center gap-1.5 font-bold cursor-pointer bg-theme-wood text-[#f4ecd8] hover:bg-theme-wood/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Ouvrir le Banc de Découpe pour extraire plusieurs phrases depuis un enregistrement complet"
      >
        <Scissors className="w-3.5 h-3.5 text-[#f4ecd8]" />
        <span>{t('openSlicerModalBtn')}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
