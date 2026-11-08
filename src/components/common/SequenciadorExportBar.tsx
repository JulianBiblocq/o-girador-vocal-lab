/**
 * SequenciadorExportBar.tsx
 * Sélecteur global d'envoi vers Sequenciador ouvrant la modale d'intégration directe au Répertoire Samambaia (< 75 lignes).
 */
import React, { useState } from 'react';
import { Drum, Piano, Rocket, Upload } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getActiveTimelinePatterns } from '../../services/cloudToadaPublisher';
import { isPatternReadyForSequenciador } from '../../utils/toadaPackExporter';
import { SamambaiaRepertoireTargetModal } from '../modals/SamambaiaRepertoireTargetModal';

export const SequenciadorExportBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { project, setSequenciadorExportMode } = useToadaProject();
  const { language } = useLanguage();
  const isBr = language === 'br';
  const [isModalOpen, setIsModalOpen] = useState(false);

  const exportMode = project.sequenciadorExportMode ?? 'rhythm_only';
  const activePatterns = getActiveTimelinePatterns(project);
  const readyCount = activePatterns.filter(isPatternReadyForSequenciador).length;
  const totalCount = activePatterns.length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-xs font-mono ${compact ? '' : 'px-2 py-1 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)]'}`}>
      <span className="font-bold text-theme-ink inline-flex items-center gap-1 text-[11px]">
        <Upload className="w-3.5 h-3.5 text-theme-accent" />
        <span>{isBr ? 'Modo Sequenciador :' : 'Mode Sequenciador :'}</span>
      </span>

      <div className="inline-flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden">
        <button
          type="button" onClick={() => setSequenciadorExportMode('rhythm_only')}
          className={`px-2 py-1 text-[11px] font-bold flex items-center gap-1 border-r border-[var(--cordel-border-sub)] cursor-pointer transition-colors ${
            exportMode === 'rhythm_only' ? 'bg-[#9a3412] text-white' : 'text-theme-ink/75 hover:bg-white/10'
          }`}
        >
          <Drum className="w-3 h-3" /><span>{isBr ? 'Ritmo apenas (Sem notas)' : 'Rythme seul (Sans notes)'}</span>
        </button>
        <button
          type="button" onClick={() => setSequenciadorExportMode('full_notes')}
          className={`px-2 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
            exportMode === 'full_notes' ? 'bg-theme-wood text-[#f4ecd8]' : 'text-theme-ink/75 hover:bg-white/10'
          }`}
        >
          <Piano className="w-3 h-3" /><span>{isBr ? 'Com as notes' : 'Avec les notes'}</span>
        </button>
      </div>

      <button
        type="button" onClick={() => setIsModalOpen(true)}
        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
        title={isBr ? `Integrar num música do Repertório Samambaia (${readyCount}/${totalCount} padrões prontos)` : `Intégrer dans un morceau du Répertoire Samambaia (${readyCount}/${totalCount} patterns prêts)`}
      >
        <Rocket className="w-3.5 h-3.5" />
        <span>{isBr ? 'Enviar ao Sequenciador' : 'Envoyer à Sequenciador'}</span>
      </button>

      <SamambaiaRepertoireTargetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
