/**
 * useGlobalTransportShortcuts.ts
 * Raccourcis clavier studio souverains (Espace, Pavé * ou R, Alt+Flèches, Alt+1..6, Escape) (< 105 lignes).
 * Filtre intelligent isTextEditingElement afin de ne jamais bloquer la saisie des syllabes Letra.
 */
import { useEffect } from 'react';
import { useVocalTransportStore, type LivretType } from '../stores/useVocalTransportStore';

export function isTextEditingElement(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    return ['text', 'number', 'search', 'password', 'email', 'url', 'tel'].includes(t);
  }
  return false;
}

const ALT_LIVRET_MAP: Record<string, LivretType> = {
  '1': 'structure',
  '2': 'prise',
  '3': 'calage',
  '4': 'melodia',
  '5': 'treino',
  '6': 'reglages',
};

export function useGlobalTransportShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('cordel-close-popovers'));
        return;
      }

      if (isTextEditingElement(document.activeElement)) return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerRedo();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('cordel-step-pattern', { detail: { delta: e.key === 'ArrowLeft' ? -1 : 1 } }));
          return;
        }
        const mapped = ALT_LIVRET_MAP[e.key];
        if (mapped) {
          e.preventDefault();
          const store = useVocalTransportStore.getState();
          if (mapped === 'treino') store.setViewRoleMode('eleve');
          else store.setActiveLivret(mapped);
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerDeleteSelected();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        useVocalTransportStore.getState().triggerPlayPause();
        return;
      }

      const isRecKey = e.code === 'NumpadMultiply' || e.key === '*' || (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r');
      if (isRecKey && useVocalTransportStore.getState().viewRoleMode !== 'eleve') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        useVocalTransportStore.getState().triggerRecord();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
}
