/**
 * studentEvaluationExporter.ts
 * Export JSON du bilan d evaluation de l eleve (justesse, date, motif, courbe).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface StudentEvaluationData {
  patternId: string;
  patternName: string;
  patternRole: string;
  accuracyScore: number;
  okNotes: number;
  totalNotes: number;
  studentPitchCurve: PitchCurvePoint[];
  date: string;
}

export function exportStudentEvaluationJson(data: StudentEvaluationData): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = data.patternName.toLowerCase().replace(/\s+/g, '_');
  a.download = `bilan_eleve_${safeName}_${data.accuracyScore}pct.json`;
  a.click();
  URL.revokeObjectURL(url);
}
