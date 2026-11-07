/**
 * project.types.ts
 * Types de suivi d'avancement par Pattern (PatternStepStatus) et ré-export du modèle Projet (< 30 lignes).
 */
export interface PatternStepStatus {
  recorded: boolean;
  trimmed: boolean;
  rhythmValidated: boolean;
  notesValidated: boolean;
  variantsReady: boolean;
}

export * from './toadaProject.types';
