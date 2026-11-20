/**
 * PwaInstallButton.tsx
 * Bouton d'installation PWA libellé (icône SVG monochrome Cordel + « Installer » / « Instalar »), affiché tant que
 * l'application n'est pas installée, en Studio comme en Vue Élève (< 40 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { InstallIcon } from '../icons/CordelActionIcons';

interface Props { isInstalled: boolean; onInstall: () => void; }

export const PwaInstallButton: React.FC<Props> = ({ isInstalled, onInstall }) => {
  const { t } = useLanguage();
  if (isInstalled) return null;
  return (
    <button
      type="button" onClick={onInstall} title={t('pwaInstallBtn')} aria-label={t('pwaInstallBtn')}
      className="h-8 px-2.5 cordel-btn-primary rounded text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer"
    >
      <InstallIcon className="w-3.5 h-3.5" />
      <span>{t('pwaInstallBtn')}</span>
    </button>
  );
};
