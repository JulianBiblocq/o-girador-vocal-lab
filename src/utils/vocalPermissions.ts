/**
 * vocalPermissions.ts
 * Gestion centralisée des droits d'accès studio et contingentement vocal.
 * Strictement < 150 lignes.
 */

export interface VocalUserPermissions {
  uid?: string;
  role?: 'mestre' | 'admin' | 'membre' | 'guest' | string;
  canWriteVocal?: boolean;        // Droit dédié aux chanteurs référents / puxadores autorisés
  canWriteSequenciador?: boolean; // Droit des rythmiciens / éditeurs séquenceur
}

export function parseUrlVocalPermissions(): { forcedMode?: 'studio' | 'eleve'; canWriteVocal?: boolean } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const treino = params.get('treino');
  const canWrite = params.get('canWriteVocal');

  if (mode === 'eleve' || treino === '1') {
    return { forcedMode: 'eleve', canWriteVocal: canWrite === '1' };
  }
  if (mode === 'studio' || canWrite === '1') {
    return { forcedMode: 'studio', canWriteVocal: true };
  }
  return {};
}

export function canAccessVocalStudio(user?: VocalUserPermissions | null): boolean {
  const urlPerms = parseUrlVocalPermissions();
  if (urlPerms.canWriteVocal === true) return true;
  if (!user) return true; // En mode démo autonome locale, ouvert par défaut
  return (
    user.role === 'mestre' ||
    user.role === 'admin' ||
    user.canWriteVocal === true ||
    user.canWriteSequenciador === true
  );
}

export function getInitialRoleMode(user?: VocalUserPermissions | null): 'studio' | 'eleve' {
  const urlPerms = parseUrlVocalPermissions();
  if (urlPerms.forcedMode) return urlPerms.forcedMode;
  return canAccessVocalStudio(user) ? 'studio' : 'eleve';
}
