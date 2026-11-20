/**
 * toadaPackIdResolver.ts
 * Résolution déterministe et sans collision de l'identifiant unique d'un pack Toada (`/toada_packs/{packId}`
 * et préfixe Storage `vocalRecordings/${packId}_${patternId}.wav`). Zéro caractère `_` dans `packId` (< 70 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';
import type { ToadaProject } from '../types/toadaProject.types';

export const LEGACY_DEFAULT_TOADA_ID = 'toada-default';

export function isLegacyDefaultToadaId(id?: string | null): boolean {
  if (!id) return true;
  const trimmed = id.trim();
  return !trimmed || trimmed === LEGACY_DEFAULT_TOADA_ID;
}

export function sanitizePackIdSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/_/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `id-${Date.now().toString(36)}`;
}

export function buildOrganizadorToadaPackId(docId: string): string {
  const trimmed = docId.trim();
  if (/^toada-/i.test(trimmed) && !isLegacyDefaultToadaId(trimmed)) {
    return `toada-${sanitizePackIdSlug(trimmed.slice(6))}`;
  }
  return `toada-${sanitizePackIdSlug(trimmed)}`;
}

export function generateFreshToadaPackId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `toada-${ts}-${rand}`;
}

export interface ResolveToadaPackIdOptions {
  forceNewIfNoDoc?: boolean;
}

export function resolveCanonicalToadaPackId(
  project?: Pick<ToadaProject, 'id' | 'toadaMeta'> | null,
  docMeta?: Partial<Pick<ToadaDocument, 'id' | 'cantadorToadaId'>> | null,
  options?: ResolveToadaPackIdOptions
): string {
  if (docMeta?.cantadorToadaId && !isLegacyDefaultToadaId(docMeta.cantadorToadaId)) {
    return sanitizePackIdSlug(docMeta.cantadorToadaId);
  }
  if (docMeta?.id && !isLegacyDefaultToadaId(docMeta.id)) {
    return buildOrganizadorToadaPackId(docMeta.id);
  }
  if (options?.forceNewIfNoDoc) {
    return generateFreshToadaPackId();
  }
  const metaCantadorId = project?.toadaMeta?.cantadorToadaId;
  if (metaCantadorId && !isLegacyDefaultToadaId(metaCantadorId)) {
    return sanitizePackIdSlug(metaCantadorId);
  }
  const metaDocId = project?.toadaMeta?.id;
  if (metaDocId && !isLegacyDefaultToadaId(metaDocId)) {
    return buildOrganizadorToadaPackId(metaDocId);
  }
  if (project?.id && !isLegacyDefaultToadaId(project.id)) {
    return sanitizePackIdSlug(project.id);
  }
  return generateFreshToadaPackId();
}
