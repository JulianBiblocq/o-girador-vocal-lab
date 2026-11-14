/**
 * activeTenantResolver.ts
 * Résolution dynamique et étanche du groupe actif SaaS dans Cantador (< 80 lignes).
 * Zéro fallback sur un UID Mestre personnel en dur ; variantes legacy limitées au seul groupe `samambaia`.
 */
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export interface ActiveTenantContext {
  uid: string | null;
  groupId: string | null;
  groupName: string | null;
  isSamambaia: boolean;
}

const groupNameCache = new Map<string, string>();

export function isLegacySamambaiaGroup(groupId?: string | null): boolean {
  return String(groupId || '').trim().toLowerCase() === 'samambaia';
}

export function buildGroupCandidates(groupId?: string | null): string[] {
  const trimmed = String(groupId || '').trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const variants = [trimmed, lower];
  if (isLegacySamambaiaGroup(lower)) {
    variants.push('Samambaia', 'samambaia', 'SAMAMBAIA');
  }
  return Array.from(new Set(variants)).filter(Boolean);
}

export function formatRepertoireLabel(groupName: string | null | undefined, isBr: boolean): string {
  const clean = String(groupName || '').trim();
  if (clean) return isBr ? `Repertório ${clean}` : `Répertoire ${clean}`;
  return isBr ? 'Repertório do grupo' : 'Répertoire du groupe';
}

export async function resolveActiveTenantContext(explicitGroupId?: string | null): Promise<ActiveTenantContext> {
  const uid = auth.currentUser?.uid || null;
  let groupId = String(explicitGroupId || '').trim() || null;

  if (!groupId && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    groupId = (params.get('groupId') || params.get('groupe') || '').trim() || null;
  }

  if (!groupId && uid) {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) groupId = String(userSnap.data()?.groupId || '').trim() || null;
    } catch {}
  }

  let groupName: string | null = null;
  if (groupId) {
    const cacheKey = groupId.toLowerCase();
    if (groupNameCache.has(cacheKey)) {
      groupName = groupNameCache.get(cacheKey) || null;
    } else {
      for (const candidate of buildGroupCandidates(groupId)) {
        try {
          const assocSnap = await getDoc(doc(db, 'associations', candidate));
          if (assocSnap.exists()) {
            const data = assocSnap.data() || {};
            const resolvedName = String(data.nom || data.name || '').trim();
            if (resolvedName) {
              groupName = resolvedName;
              groupNameCache.set(cacheKey, resolvedName);
              break;
            }
          }
        } catch {}
      }
    }
  }

  return { uid, groupId, groupName, isSamambaia: isLegacySamambaiaGroup(groupId) };
}
