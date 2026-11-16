/**
 * vocalPermissions.ts
 * Gestion centralisée des droits d'accès Studio (`canWriteCantador`) et Page Dédiée Élève (< 75 lignes).
 */

export interface VocalUserPermissions {
  uid?: string;
  role?: 'mestre' | 'admin' | 'super-admin' | 'membre' | 'eleve' | 'guest' | string;
  dbRole?: string;
  isSystemAdmin?: boolean;
  canWriteCantador?: boolean; // Droit officiel attribué aux chanteurs référents / puxadores désignés
  canWriteVocal?: boolean;    // Alias rétrocompatible
}

export interface PermissionEnvOptions {
  search?: string;
  hostname?: string;
}

export function isLocalDevEnvironment(hostname?: string): boolean {
  const h = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local');
}

export function parseUrlVocalPermissions(searchStr?: string): {
  forcedMode?: 'studio' | 'eleve';
  canWriteCantador?: boolean;
} {
  const rawSearch = searchStr ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!rawSearch) return {};
  const params = new URLSearchParams(rawSearch);
  const mode = (params.get('mode') || '').toLowerCase();
  const treino = params.get('treino');
  const canWrite = params.get('canWriteCantador') ?? params.get('canWriteVocal');

  if (mode === 'eleve' || treino === '1') {
    return { forcedMode: 'eleve', canWriteCantador: canWrite === '1' };
  }
  if (mode === 'studio' || canWrite === '1') {
    return { forcedMode: 'studio', canWriteCantador: true };
  }
  return {};
}

export function canAccessVocalStudio(
  user?: VocalUserPermissions | null,
  opts?: PermissionEnvOptions
): boolean {
  const urlPerms = parseUrlVocalPermissions(opts?.search);
  if (urlPerms.canWriteCantador === true) return true;
  if (user) {
    const role = String(user.role || user.dbRole || '').toLowerCase();
    return (
      role === 'mestre' ||
      role === 'mestri' ||
      role === 'admin' ||
      role === 'super-admin' ||
      user.isSystemAdmin === true ||
      user.canWriteCantador === true ||
      user.canWriteVocal === true
    );
  }
  if (urlPerms.forcedMode === 'eleve') return false;
  return isLocalDevEnvironment(opts?.hostname);
}

export function getInitialRoleMode(
  user?: VocalUserPermissions | null,
  opts?: PermissionEnvOptions
): 'studio' | 'eleve' {
  const urlPerms = parseUrlVocalPermissions(opts?.search);
  if (urlPerms.forcedMode === 'eleve') return 'eleve';
  if (urlPerms.forcedMode === 'studio' && canAccessVocalStudio(user, opts)) return 'studio';
  return canAccessVocalStudio(user, opts) ? 'studio' : 'eleve';
}
