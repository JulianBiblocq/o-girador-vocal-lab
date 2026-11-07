/**
 * SequenciadorExportBar.tsx
 * Sélecteur global d'envoi vers Sequenciador avec retour visuel ✓ Envoyé à Sequenciador ! + confirmation Cordel (< 95 lignes).
 */
import React from 'react';
import { Drum, Piano, Rocket, Loader2, Upload, Check } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { publishToadaToSequencer, getActiveTimelinePatterns } from '../../services/cloudToadaPublisher';
import { isPatternReadyForSequenciador } from '../../utils/toadaPackExporter';
import { alertAsync } from '../../stores/useCordelDialogStore';
import { useActionFeedback } from './useActionFeedback';

export const SequenciadorExportBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { project, setSequenciadorExportMode, loadProject } = useToadaProject();
  const { language } = useLanguage();
  const isBr = language === 'br';
  const sendFeedback = useActionFeedback(isBr ? '✓ Enviado ao Sequenciador !' : '✓ Envoyé à Sequenciador !');

  const exportMode = project.sequenciadorExportMode ?? 'rhythm_only';
  const activePatterns = getActiveTimelinePatterns(project);
  const readyCount = activePatterns.filter(isPatternReadyForSequenciador).length;
  const totalCount = activePatterns.length;

  const handleSendToSequenciador = async () => {
    if (sendFeedback.isLoading) return;
    try {
      await sendFeedback.trigger(async () => {
        const res = await publishToadaToSequencer(project);
        loadProject({
          ...project,
          sequenciadorSyncedAt: Date.now(),
          sequenciadorLastExportMode: exportMode,
        });
        const label = isBr ? '✓ Enviado ao Sequenciador !' : '✓ Envoyé à Sequenciador !';
        const summaryMsg = isBr
          ? `${res.exportedPatternsCount} padrões ativos exportados (${res.savedMegabytes} Mo economizados).`
          : `${res.exportedPatternsCount} patterns actifs exportés (${res.savedMegabytes} Mo économisés).`;
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `${label} ${summaryMsg}` } }));
        await alertAsync({
          title: label,
          message: summaryMsg,
          variant: 'info',
        });
        if (res.sequenciadorUrl) window.open(res.sequenciadorUrl, '_blank', 'noopener,noreferrer');
        return label;
      });
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err?.message || 'Erreur lors de l’envoi vers Sequenciador' } }));
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
        type="button" onClick={handleSendToSequenciador} disabled={sendFeedback.isLoading}
        className={sendFeedback.getButtonClass('px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50')}
        title={isBr ? `Enviar a toada para o Sequenciador (${readyCount}/${totalCount} padrões prontos)` : `Envoyer la chanson à Sequenciador (${readyCount}/${totalCount} patterns prêts)`}
      >
        {sendFeedback.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sendFeedback.isSuccess ? <Check className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
        <span>{sendFeedback.isLoading ? (isBr ? 'Em curso...' : 'En cours...') : sendFeedback.isSuccess ? sendFeedback.successLabel : (isBr ? 'Enviar ao Sequenciador' : 'Envoyer à Sequenciador')}</span>
      </button>
    </div>
  );
};
