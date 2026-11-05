/**
 * useAppUpdate.ts
 * Détection de mise à jour de l'application via version.json (< 85 lignes).
 */
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ogirador_cantador_build_time';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [remoteBuildTime, setRemoteBuildTime] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.buildTime) return;

      const localTime = localStorage.getItem(STORAGE_KEY);
      if (!localTime) {
        localStorage.setItem(STORAGE_KEY, data.buildTime);
        return;
      }

      if (localTime !== data.buildTime) {
        setRemoteBuildTime(data.buildTime);
        setUpdateAvailable(true);
      }
    } catch {
      // Ignorer les erreurs réseau silencieusement
    }
  }, []);

  const reloadApp = useCallback(async () => {
    if (remoteBuildTime) {
      try {
        localStorage.setItem(STORAGE_KEY, remoteBuildTime);
      } catch { /* ignore */ }
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } catch { /* ignore */ }
    window.location.reload();
  }, [remoteBuildTime]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  useEffect(() => {
    checkForUpdate();

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    const timer = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(timer);
    };
  }, [checkForUpdate]);

  return { updateAvailable, reloadApp, dismissUpdate };
}
