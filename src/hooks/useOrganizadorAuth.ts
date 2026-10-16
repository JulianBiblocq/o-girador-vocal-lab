/**
 * useOrganizadorAuth.ts
 * Hook d'authentification unifiée SSO & Google Auth pour Cantador (< 80 lignes).
 */
import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  handleSsoUrlToken,
  signInWithGoogle,
  logoutUser,
  getUserGroupId,
} from '../services/firebaseClient';

export interface OrganizadorAuthState {
  currentUser: User | null;
  groupId: string | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useOrganizadorAuth(): OrganizadorAuthState {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Consommation automatique du token SSO s'il est présent dans l'URL
  useEffect(() => {
    handleSsoUrlToken().catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const gId = await getUserGroupId(user.uid);
          setGroupId(gId);
        } catch {
          setGroupId(null);
        }
      } else {
        setGroupId(null);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.warn('[useOrganizadorAuth] Erreur login Google :', err);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: `Échec de connexion : ${err?.message || 'erreur'}` },
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setGroupId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { currentUser, groupId, isLoading, loginWithGoogle, logout };
}
