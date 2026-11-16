/**
 * vocalDsp.worker.ts
 * Web Worker DSP dédié de Cantador (Vite { type: 'module' }) (< 55 lignes).
 * Exécute runVocalDspTask hors thread principal et renvoie les ArrayBuffer neufs en Transferable zéro-copie.
 */
import { runVocalDspTask, collectResultTransferables } from './vocalDspTaskRunner';
import type { VocalDspWorkerRequest, VocalDspWorkerResponse } from './vocalDspProtocol.types';

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<VocalDspWorkerRequest>) => void) | null;
  postMessage: (message: VocalDspWorkerResponse, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerScopeLike;

workerScope.onmessage = (event: MessageEvent<VocalDspWorkerRequest>) => {
  const req = event.data;
  if (!req || !req.requestId || !req.taskType) return;

  try {
    const result = runVocalDspTask(req.taskType, req.payload);
    const transferables = collectResultTransferables(req.taskType, result);
    const response: VocalDspWorkerResponse = {
      requestId: req.requestId,
      taskType: req.taskType,
      ok: true,
      result,
    };
    workerScope.postMessage(response, transferables);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errResponse: VocalDspWorkerResponse = {
      requestId: req.requestId,
      taskType: req.taskType,
      ok: false,
      error: message,
    };
    workerScope.postMessage(errResponse);
  }
};
