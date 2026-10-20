/**
 * usePwaInstall.ts
 * Hook de détection et déclenchement d'installation PWA (< 75 lignes).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { alertAsync } from '../stores/useCordelDialogStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isNav = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isMedia || isNav;
}

export function usePwaInstall(locale: 'fr' | 'br' = 'fr') {
  const [isInstalled, setIsInstalled] = useState<boolean>(checkIsStandalone);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptNatively, setCanPromptNatively] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => { if (e.matches) setIsInstalled(true); };
    media.addEventListener('change', handleMediaChange);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPromptNatively(true);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      deferredPromptRef.current = null;
      setCanPromptNatively(false);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      media.removeEventListener('change', handleMediaChange);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const choice = await deferredPromptRef.current.userChoice;
      if (choice.outcome === 'accepted') setIsInstalled(true);
      deferredPromptRef.current = null;
      setCanPromptNatively(false);
      return;
    }

    const isBr = locale === 'br';
    await alertAsync({
      title: isBr ? 'Instalar o Cantador' : 'Installer Cantador',
      message: isBr
        ? '📲 Para instalar o Cantador no seu dispositivo :\n\n• Chrome / Edge : clique no menu ⋮ (ou no ícone na barra de endereço) ➔ "Instalar a página como aplicativo".\n\n• Safari iOS : toque no botão Compartilhar ➔ "Adicionar à Tela de Início".'
        : '📲 Pour installer Cantador sur votre appareil :\n\n• Chrome / Edge : cliquez sur le menu ⋮ (ou l\'icône dans la barre d\'adresse) ➔ "Installer la page en tant qu\'application".\n\n• Safari iOS : appuyez sur le bouton Partager ➔ "Sur l\'écran d\'accueil".',
      confirmLabel: isBr ? 'Entendido' : 'Compris',
      variant: 'info',
    });
  }, [locale]);

  return { isInstalled, canPromptNatively, triggerInstall };
}
