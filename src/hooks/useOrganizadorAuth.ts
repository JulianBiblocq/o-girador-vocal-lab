/**
 * useOrganizadorAuth.ts
 * Hook d'authentification unifiée SSO & Google Auth + synchronisation du droit `canWriteCantador` (< 105 lignes).
 */
import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleSsoUrlToken, signInWithGoogle, logoutUser } from '../services/firebaseClient';
import { canAccessVocalStudio, type VocalUserPermissions } from '../utils/vocalPermissions';
import { useVocalTransportStore } from '../stores/useVocalTransportStore';

export interface OrganizadorAuthState {
  currentUser: User | null;
  groupId: string | null;
  userPermissions: VocalUserPermissions | null;
  canWriteStudio: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useOrganizadorAuth(): OrganizadorAuthState {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<VocalUserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let isMounted = true;

    handleSsoUrlToken()
      .catch(() => {})
      .finally(() => {
        if (!isMounted) return;
        unsub = onAuthStateChanged(auth, async (user) => {
          if (!isMounted) return;
          setCurrentUser(user);
          if (user) {
            try {
              const snap = await getDoc(doc(db, 'users', user.uid));
              const data = snap.exists() ? snap.data() : {};
              const perms: VocalUserPermissions = {
                uid: user.uid,
                role: data.role || data.dbRole || 'membre',
                dbRole: data.dbRole,
                isSystemAdmin: Boolean(data.isSystemAdmin),
                canWriteCantador: Boolean(data.canWriteCantador),
                canWriteVocal: Boolean(data.canWriteVocal),
              };
              if (isMounted) {
                setGroupId(data.groupId || null);
                setUserPermissions(perms);
                useVocalTransportStore.getState().setUserPermissions(perms);
              }
            } catch {
              const fallbackPerms: VocalUserPermissions = { uid: user.uid, role: 'membre' };
              if (isMounted) {
                setGroupId(null);
                setUserPermissions(fallbackPerms);
                useVocalTransportStore.getState().setUserPermissions(fallbackPerms);
              }
            }
          } else if (isMounted) {
            setGroupId(null);
            setUserPermissions(null);
            useVocalTransportStore.getState().setUserPermissions(null);
          }
          if (isMounted) setIsLoading(false);
        });
      });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: `Échec de connexion : ${err?.message || 'erreur'}` } }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setGroupId(null);
      setUserPermissions(null);
      useVocalTransportStore.getState().setUserPermissions(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { currentUser, groupId, userPermissions, canWriteStudio: canAccessVocalStudio(userPermissions), isLoading, loginWithGoogle, logout };
}
