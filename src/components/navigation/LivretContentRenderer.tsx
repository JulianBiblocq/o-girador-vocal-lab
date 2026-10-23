/**
 * LivretContentRenderer.tsx
 * Aiguillage et rendu du Livret actif parmi les 5 Livrets + ⚙️ Réglages (< 60 lignes).
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
  const { activeLivret } = useVocalTransportStore();

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
