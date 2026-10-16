import type {
  ToadaProject, VocalPatternItem, VocalRole, VocalAudioVariant,
} from './toadaProject.types';

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
}
