import type {
  ToadaProject, VocalPatternItem, VocalRole, VocalAudioVariant,
} from './toadaProject.types';
import type { TimeSignatureString } from './vocalPack.types';
import type { MetricApplyScope } from '../utils/projectBatchOps';

export interface ToadaProjectContextValue {
  project: ToadaProject;
  activePattern: VocalPatternItem;
  activeVariant: VocalAudioVariant;
  cueMode: string;
  setActivePatternId: (id: string) => void;
  setActiveVariantKey: (patternId: string, variantKey: string) => void;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  ensureVariantExists: (patternId: string, speedRatio: number, pitchShiftSemitones: number) => string;
  addPattern: (role: VocalRole, name?: string) => string;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  removePattern: (id: string) => void;
  mirrorPatternToRole: (sourcePatternId: string, targetRole: VocalRole) => string;
  unlinkPattern: (patternId: string) => void;
  loadProject: (newProject: ToadaProject) => void;
  addSlot: () => void;
  removeSlot: (slotId: string) => void;
  updateSlot: (slotId: string, puxadorId: string | null, coroId: string | null) => void;
  setCueMode: (mode: string) => void;
  getPreviousConductorPattern: () => VocalPatternItem | null;
  swapAllRoles: () => void;
  duplicateVariation: (patternId: string) => string;
  // Gestion de la portée métrique & sélection de patterns
  applyScope: MetricApplyScope;
  setApplyScope: (scope: MetricApplyScope) => void;
  selectedPatternIds: string[];
  toggleSelectPattern: (id: string) => void;
  selectAllPatterns: (select: boolean) => void;
  clearSelectedPatterns: () => void;
  updateScopedBpm: (bpm: number) => void;
  updateScopedMeasuresCount: (count: 1 | 2 | 3 | 4) => void;
  updateScopedHasAnacrusis: (has: boolean) => void;
  updateScopedReferencePitch: (pitch: string) => void;
  updateScopedTimeSignature: (sig: TimeSignatureString) => void;
  updateScopedTessitura: (tessitura: import('./tessitura.types').TessituraRange) => void;
  updateHarmonyConfig: (config: import('./harmony.types').HarmonyConfig) => void;
  updateToadaMeta: (meta: Partial<import('./toadaDocument.types').ToadaDocument>) => void;
}
