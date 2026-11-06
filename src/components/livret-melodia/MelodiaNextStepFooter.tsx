/**
 * MelodiaNextStepFooter.tsx
 * Pied de page de fin d'étape pour LivretMelodia (< 120 lignes).
 * Inclut le bouton direct [ Renvoyer vers Organizador (Rythme, Syllabes _, Tonalité & Tempo) ].
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { publishToadaToOrganizador } from '../../services/organizadorToadaPublisher';
import { CheckCircle2, Save, Mic, Music2, Headphones, RefreshCw } from 'lucide-react';

export const MelodiaNextStepFooter: React.FC = () => {
  const { project, activePattern, setActivePatternId, loadProject } = useToadaProject();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const { t } = useLanguage();
  const [isPushingOrg, setIsPushingOrg] = useState(false);

  const activeNotesCount = [
    ...(activePattern.anacrusisSteps || []),
    ...(activePattern.mainSteps || []),
  ].filter((s) => s.active && s.note !== '───').length;

  const nextPattern = project.patterns.find(
    (p) => p.id !== activePattern.id && (!p.recordingResult || p.recordingResult.pcm.length === 0)
  ) ?? project.patterns.find((p) => p.id !== activePattern.id);

  const handleManualSave = () => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message: t('melodiaSavedPatternToast', { name: activePattern.name }), type: 'success' },
      })
    );
  };

  const handlePushToOrganizador = async () => {
    if (isPushingOrg) return;
    setIsPushingOrg(true);
    try {
      const res = await publishToadaToOrganizador(project, project.toadaMeta?.groupId || 'samambaia');
      loadProject({
        ...project,
        toadaMeta: {
          ...(project.toadaMeta || {}),
          id: res.documentId,
          bpmDefaut: res.bpm,
          tonaliteDefaut: res.scaleLabel,
        },
      });
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            type: 'success',
            message: `Fiche Organizador mise à jour (${res.bpm} BPM • Gamme : ${res.scaleLabel} • Temps & Syllabes synchronisés)`,
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: t('publishOrganizadorErrorToast', { err: err?.message || 'err' }) },
        })
      );
    } finally {
      setIsPushingOrg(false);
    }
  };

  const handleRecordNext = () => {
    if (nextPattern) setActivePatternId(nextPattern.id);
    setActiveLivret('prise');
  };

  const handleBackToStructure = () => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message: t('melodiaKeptPatternToast', { name: activePattern.name }), type: 'info' },
      })
    );
    setActiveLivret('structure');
  };

  return (
    <div className="cordel-card p-3 flex flex-col md:flex-row items-center justify-between gap-3 bg-[var(--cordel-surface)] border-2 border-emerald-600/40 rounded shadow-md mt-2">
      <div className="flex items-center gap-2 text-xs font-mono">
        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            {t('melodiaValidatedTitle', { name: activePattern.name, count: activeNotesCount })}
          </span>
          <span className="text-[10px] text-[var(--cordel-secondary-text)]">
            {t('melodiaValidatedSub')}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={handlePushToOrganizador} disabled={isPushingOrg}
          title="Sauvegarder et renvoyer le rythme ([1]..[4] et _), les syllabes soulignées (<u>), la tonalité et le tempo vers la fiche Organizador"
          className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPushingOrg ? 'animate-spin' : ''}`} />
          <span>Renvoyer vers Organizador (Rythme, Syllabes _, Tonalité & Tempo)</span>
        </button>

        <button
          type="button" onClick={handleManualSave} title={t('melodiaSaveProgressTitle')}
          className="cordel-btn px-2.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t('btnSaveToada')}</span>
        </button>

        <button
          type="button" onClick={handleRecordNext}
          title={nextPattern ? t('melodiaRecordNextTitle', { name: nextPattern.name }) : t('melodiaRecordNewTitle')}
          className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{nextPattern ? t('melodiaRecordNextBtn', { name: nextPattern.name }) : t('melodiaGoCabineBtn')}</span>
        </button>

        <button
          type="button" onClick={() => setActiveLivret('treino')} title={t('melodiaGoTreinoTitle')}
          className="cordel-btn px-2.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 cursor-pointer"
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>{t('melodiaGoTreinoBtn')}</span>
        </button>

        <button
          type="button" onClick={handleBackToStructure} title={t('melodiaBackLivret1Title')}
          className="cordel-card-sm px-2.5 py-1.5 text-xs font-mono flex items-center gap-1.5 hover:bg-white/10 cursor-pointer"
        >
          <Music2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('melodiaBackLivret1Btn')}</span>
        </button>
      </div>
    </div>
  );
};
