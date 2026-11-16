/**
 * MelodiaNextStepFooter.tsx
 * Pied de page compact de fin d'étape pour LivretMelodia (boutons courts + info-bulles complètes) (< 95 lignes).
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { publishToadaToOrganizador } from '../../services/organizadorToadaPublisher';
import { CheckCircle2, Mic, Headphones, RefreshCw, Layers } from 'lucide-react';

export const MelodiaNextStepFooter: React.FC = () => {
  const { project, activePattern, setActivePatternId, loadProject } = useToadaProject();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const setViewRoleMode = useVocalTransportStore((s) => s.setViewRoleMode);
  const { t, language } = useLanguage(), isBr = language === 'br';
  const [isPushingOrg, setIsPushingOrg] = useState(false);

  const activeNotesCount = [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])]
    .filter((s) => s.active && s.note !== '───').length;

  const nextPattern = project.patterns.find(
    (p) => p.id !== activePattern.id && (!p.recordingResult || p.recordingResult.pcm.length === 0)
  ) ?? project.patterns.find((p) => p.id !== activePattern.id);

  const handlePushToOrganizador = async () => {
    if (isPushingOrg) return;
    setIsPushingOrg(true);
    try {
      const res = await publishToadaToOrganizador(project, project.toadaMeta?.groupId);
      loadProject({
        ...project, organizadorSyncedAt: Date.now(),
        toadaMeta: { ...(project.toadaMeta || {}), id: res.documentId, bpmDefaut: res.bpm, tonaliteDefaut: res.scaleLabel },
      });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: `✓ Organizador (${res.bpm} BPM • ${res.scaleLabel})` } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: t('publishOrganizadorErrorToast', { err: err?.message || 'err' }) } }));
    } finally { setIsPushingOrg(false); }
  };

  return (
    <div className="cordel-card px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 rounded">
      <div className="flex items-center gap-2 text-xs font-mono">
        <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <span className="font-bold text-emerald-800 dark:text-emerald-300">
          {t('melodiaValidatedTitle', { name: activePattern.name, count: activeNotesCount })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <button
          type="button" onClick={handlePushToOrganizador} disabled={isPushingOrg}
          title={isBr ? 'Enviar ritmo, sílabas, tonalidade e andamento ao Organizador' : 'Renvoyer le rythme, les syllabes, la tonalité et le tempo vers Organizador'}
          className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPushingOrg ? 'animate-spin' : ''}`} />
          <span>Organizador</span>
        </button>

        <button
          type="button"
          onClick={() => { if (nextPattern) setActivePatternId(nextPattern.id); setActiveLivret('prise'); }}
          title={nextPattern ? t('melodiaRecordNextTitle', { name: nextPattern.name }) : t('melodiaRecordNewTitle')}
          className="cordel-btn-primary px-2.5 py-1 font-bold flex items-center gap-1.5 cursor-pointer rounded"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{isBr ? 'Próxima frase' : 'Phrase suiv.'}</span>
        </button>

        <button
          type="button" onClick={() => setViewRoleMode('eleve')} title={t('melodiaGoTreinoTitle')}
          className="px-2.5 py-1 rounded bg-[#0f766e] hover:opacity-90 text-white font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Headphones className="w-3.5 h-3.5" /><span>{t('btnStudentPreview')}</span>
        </button>

        <button
          type="button" onClick={() => setActiveLivret('structure')} title={t('melodiaBackLivret1Title')}
          className="cordel-card-sm px-2.5 py-1 font-bold flex items-center gap-1.5 cursor-pointer rounded"
        >
          <Layers className="w-3.5 h-3.5 text-theme-accent" /><span>{t('fanion1Short')}</span>
        </button>
      </div>
    </div>
  );
};
