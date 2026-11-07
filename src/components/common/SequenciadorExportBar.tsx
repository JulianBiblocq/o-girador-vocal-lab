/**
 * SequenciadorExportBar.tsx
 * Sélecteur global d'envoi vers Sequenciador (valable pour toute la chanson) :
 * Mode Sequenciador : [ Rythme seul (Sans notes) | Avec les notes ] + [ Envoyer à Sequenciador ] (< 85 lignes).
 */
import React, { useState } from 'react';
import { Drum, Piano, Rocket, Loader2, Upload } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { publishToadaToSequencer } from '../../services/cloudToadaPublisher';
import { isPatternReadyForSequenciador } from '../../utils/toadaPackExporter';

export const SequenciadorExportBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { project, setSequenciadorExportMode, loadProject } = useToadaProject();
  const { language } = useLanguage();
  const isBr = language === 'br';
  const [isSending, setIsSending] = useState(false);

  const exportMode = project.sequenciadorExportMode ?? 'rhythm_only';
  const readyCount = project.patterns.filter(isPatternReadyForSequenciador).length;
  const totalCount = project.patterns.length;

  const handleSendToSequenciador = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await publishToadaToSequencer(project);
      loadProject({
        ...project,
        sequenciadorSyncedAt: Date.now(),
        sequenciadorLastExportMode: exportMode,
      });
      const modeLabel = exportMode === 'rhythm_only'
        ? (isBr ? 'Ritmo apenas (Sem notas)' : 'Rythme seul (Sans notes)')
        : (isBr ? 'Com as notas' : 'Avec les notes');
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            type: 'success',
            message: isBr
              ? `Toada enviada ao Sequenciador (${readyCount}/${totalCount} padrões prontos • ${modeLabel})`
              : `Toada envoyée à Sequenciador (${readyCount}/${totalCount} patterns prêts • ${modeLabel})`,
          },
        })
      );
      if (res.sequenciadorUrl) window.open(res.sequenciadorUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: err?.message || 'Erreur lors de l’envoi vers Sequenciador' },
        })
      );
    } finally {
      setIsSending(false);
    }
  };

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
          <Piano className="w-3 h-3" /><span>{isBr ? 'Com as notas' : 'Avec les notes'}</span>
        </button>
      </div>

      <button
        type="button" onClick={handleSendToSequenciador} disabled={isSending}
        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
        title={isBr ? `Enviar a toada para o Sequenciador (${readyCount}/${totalCount} padrões prontos)` : `Envoyer la chanson à Sequenciador (${readyCount}/${totalCount} patterns prêts)`}
      >
        {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
        <span>{isBr ? 'Enviar ao Sequenciador' : 'Envoyer à Sequenciador'}</span>
      </button>
    </div>
  );
};

