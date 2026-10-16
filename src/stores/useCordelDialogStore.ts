/**
 * useCordelDialogStore.ts
 * Store pour dialogues et alertes asynchrones universels Cordel (< 80 lignes).
 * Implémenté via un micro-store pub/sub et useSyncExternalStore (0 dépendance externe).
 */
import { useSyncExternalStore } from 'react';

export interface CordelDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export interface CordelDialogState {
  isOpen: boolean;
  type: 'confirm' | 'alert';
  options: CordelDialogOptions;
}

let state: CordelDialogState = {
  isOpen: false,
  type: 'alert',
  options: { message: '' },
};

let resolvePromise: ((value: boolean) => void) | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function confirmAsync(options: CordelDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    state = { isOpen: true, type: 'confirm', options };
    resolvePromise = resolve;
    notify();
  });
}

export function alertAsync(options: CordelDialogOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    state = { isOpen: true, type: 'alert', options };
    resolvePromise = () => resolve();
    notify();
  });
}

export function closeDialog(result: boolean): void {
  if (resolvePromise) resolvePromise(result);
  resolvePromise = null;
  state = { ...state, isOpen: false };
  notify();
}

export function useCordelDialogStore(): CordelDialogState & { close: (result: boolean) => void } {
  const current = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => state
  );
  return { ...current, close: closeDialog };
}
