import type {
  ToadaProject, VocalPatternItem, VocalRole, VocalAudioVariant, SequenciadorExportMode, PatternStepStatus,
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
  updatePatternAndVariant: (
    patternId: string,
    variantKey: string,
    patternPartial: Partial<VocalPatternItem>,
    variantPartial: Partial<VocalAudioVariant>
  ) => void;
  ensureVariantExists: (patternId: string, speedRatio: number, pitchShiftSemitones: number) => string;
  addPattern: (role: VocalRole, name?: string) => string;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  removePattern: (id: string) => void;
  mirrorPatternToRole: (sourcePatternId: string, targetRole: VocalRole) => string;
  injectPatternIntoTarget: (sourceId: string, targetId: string) => void;
  unlinkPattern: (patternId: string) => void;
  loadProject: (newProject: ToadaProject) => void;
  addSlot: (advanceMeasures?: number) => void;
  removeSlot: (slotId: string) => void;
  updateSlot: (slotId: string, puxadorId: string | null, coroId: string | null, advanceMeasures?: number) => void;
  reorderSlots: (fromIndex: number, toIndex: number) => void;
  setCueMode: (mode: string) => void;
  getPreviousConductorPattern: () => VocalPatternItem | null;
  swapAllRoles: () => void;
  duplicateVariation: (patternId: string) => string;
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
  togglePatternFoldNotes: (patternId: string, folded?: boolean) => void;
  setAllPatternsFoldNotes: (folded: boolean) => void;
  setSequenciadorExportMode: (mode: SequenciadorExportMode) => void;
  updatePatternStepStatus: (patternId: string, partial: Partial<PatternStepStatus>) => void;
}
