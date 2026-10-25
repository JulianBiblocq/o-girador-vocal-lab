/**
 * MelodiaNextStepFooter.tsx
 * Pied de page de fin d'étape pour LivretMelodia (< 85 lignes).
 * Badge de validation rassurant, sauvegarde explicite et navigation fluide vers Livret 1 ou 2.
 */
import React from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { CheckCircle2, Save, Mic, Music2 } from 'lucide-react';

export const MelodiaNextStepFooter: React.FC = () => {
  const { project, activePattern, setActivePatternId } = useToadaProject();
  const { setActiveLivret } = useVocalTransportStore();

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
        detail: {
          message: `✓ Avancement du pattern "${activePattern.name}" sauvegardé avec succès !`,
          type: 'success',
        },
      })
    );
  };

  const handleRecordNext = () => {
    if (nextPattern) {
      setActivePatternId(nextPattern.id);
    }
    setActiveLivret('prise');
  };

  const handleBackToStructure = () => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          message: `✓ Travail mélodique conservé pour "${activePattern.name}".`,
          type: 'info',
        },
      })
    );
    setActiveLivret('structure');
  };

  return (
    <div className="cordel-card p-3 flex flex-col md:flex-row items-center justify-between gap-3 bg-[var(--cordel-surface)] border-2 border-emerald-600/40 rounded shadow-md mt-2">
      {/* Badge rassurant de validation */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-bold text-emerald-300">
            ✓ Pattern « {activePattern.name} » validé ({activeNotesCount} notes)
          </span>
          <span className="text-[10px] text-[var(--cordel-secondary-text)]">
            Votre travail est conservé en mémoire et prêt pour l&apos;export.
          </span>
        </div>
      </div>

      {/* Boutons d'action explicites */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleManualSave}
          className="cordel-btn px-2.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 text-amber-300 hover:text-amber-200 cursor-pointer"
          title="Sauvegarder l'avancement dans le projet"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Sauvegarder</span>
        </button>

        <button
          type="button"
          onClick={handleRecordNext}
          className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          title={nextPattern ? `Enregistrer ${nextPattern.name}` : 'Enregistrer une nouvelle prise'}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{nextPattern ? `Enregistrer : ${nextPattern.name} →` : 'Cabine de Prise (Livret 2) →'}</span>
        </button>

        <button
          type="button"
          onClick={handleBackToStructure}
          className="cordel-card-sm px-2.5 py-1.5 text-xs font-mono flex items-center gap-1.5 hover:bg-white/10 cursor-pointer"
          title="Revenir au Livret 1 en toute sécurité"
        >
          <Music2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>Retour au Livret 1</span>
        </button>
      </div>
    </div>
  );
};
