/**
 * useGlobalTransportShortcuts.ts
 * Raccourcis clavier studio souverains (Espace = Play/Pause, * = Record) (< 80 lignes).
 * Filtre intelligent isTextEditingElement afin de ne jamais bloquer le transport sur sliders ou boutons.
 */
import { useEffect } from 'react';
import { useVocalTransportStore } from '../stores/useVocalTransportStore';

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

export function useGlobalTransportShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextEditingElement(document.activeElement)) return;

      // 1. Undo : Ctrl+Z / Cmd+Z (sans Shift)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerUndo();
        return;
      }

      // 2. Redo : Ctrl+Shift+Z / Cmd+Shift+Z ou Ctrl+Y / Cmd+Y
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerRedo();
        return;
      }

      // 3. Suppression rapide : Delete ou Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        useVocalTransportStore.getState().triggerDeleteSelected();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        useVocalTransportStore.getState().triggerPlayPause();
        return;
      }

      if (e.code === 'NumpadMultiply' || e.key === '*') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        useVocalTransportStore.getState().triggerRecord();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
}
