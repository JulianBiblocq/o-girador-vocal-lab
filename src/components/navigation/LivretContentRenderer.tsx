/**
 * LivretContentRenderer.tsx
 * Aiguillage et rendu du Livret actif avec garde-fou strict en Vue Élève (< 45 lignes).
 */
import React from 'react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { LivretStructure } from '../livret-structure/LivretStructure';
import { LivretPrise } from '../livret-prise/LivretPrise';
import { LivretCalage } from '../livret-calage/LivretCalage';
import { LivretMelodia } from '../livret-melodia/LivretMelodia';
import { LivretTreino } from '../livret-treino/LivretTreino';
import { LivretReglages } from '../livret-reglages/LivretReglages';

export const LivretContentRenderer: React.FC = () => {
  const activeLivret = useVocalTransportStore((s) => s.activeLivret);
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);

  if (viewRoleMode === 'eleve') {
    return activeLivret === 'reglages' ? <LivretReglages /> : <LivretTreino />;
  }

  switch (activeLivret) {
    case 'structure':
      return <LivretStructure />;
    case 'prise':
      return <LivretPrise />;
    case 'calage':
      return <LivretCalage />;
    case 'melodia':
      return <LivretMelodia />;
    case 'treino':
      return <LivretTreino />;
    case 'reglages':
      return <LivretReglages />;
    default:
      return <LivretStructure />;
  }
};
