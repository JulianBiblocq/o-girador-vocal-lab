/**
 * vocalDspWorkerClient.ts
 * Client Singleton du Web Worker DSP avec déduplication Latest-Wins (`dedupeKey`),
 * protection stricte de non-détachement des Float32Array sources et fallback Node.js transparent (< 134 lignes).
 */
import { getEffectiveVocalBounds } from '../utils/ambitusStorage';
import { runVocalDspTask } from './vocalDspTaskRunner';
import {
  isVocalDspCancelled,
  type VocalDspTaskType, type VocalDspPayloadMap, type VocalDspResultMap,
  type VocalDspWorkerRequest, type VocalDspWorkerResponse, type VocalDspCancelledError,
  type ExtractMelodicTaskPayload, type ExtractMelodicTaskResult,
  type ReanalyzeSyllablesBatchItem, type ReanalyzeSyllablesTaskResult,
  type RenderVoiceTaskPayload, type RenderVoiceTaskResult,
  type EncodeWavTaskPayload, type EncodeWavTaskResult,
} from './vocalDspProtocol.types';

export { isVocalDspCancelled };
export interface VocalDspCallOptions { dedupeKey?: string; }
interface PendingEntry { requestId: string; dedupeKey?: string; resolve: (value: any) => void; reject: (reason: any) => void; }

let singletonWorker: Worker | null = null, requestSeq = 0;
const pendingMap = new Map<string, PendingEntry>();
const activeByDedupeKey = new Map<string, string>();
const busyListeners = new Set<(busyCount: number) => void>();

const notifyBusy = () => { const c = pendingMap.size; busyListeners.forEach((fn) => fn(c)); };
export const getVocalDspBusyCount = (): number => pendingMap.size;
export function subscribeVocalDspBusy(listener: (busyCount: number) => void): () => void {
  busyListeners.add(listener); listener(pendingMap.size);
  return () => { busyListeners.delete(listener); };
}

function getOrCreateWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!singletonWorker) {
    singletonWorker = new Worker(new URL('./vocalDsp.worker.ts', import.meta.url), { type: 'module' });
    singletonWorker.onmessage = (ev: MessageEvent<VocalDspWorkerResponse>) => {
      const msg = ev.data;
      if (!msg?.requestId) return;
      const entry = pendingMap.get(msg.requestId);
      if (!entry) return;
      pendingMap.delete(msg.requestId);
      if (entry.dedupeKey && activeByDedupeKey.get(entry.dedupeKey) === msg.requestId) activeByDedupeKey.delete(entry.dedupeKey);
      notifyBusy();
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error || 'Vocal DSP Worker error'));
    };
    singletonWorker.onerror = (ev) => {
      const err = new Error(ev.message || 'Vocal DSP Worker crashed'), all = Array.from(pendingMap.values());
      pendingMap.clear(); activeByDedupeKey.clear(); notifyBusy();
      all.forEach((e) => e.reject(err));
    };
  }
  return singletonWorker;
}

function cloneNodeFallbackPayload<T extends VocalDspTaskType>(taskType: T, payload: VocalDspPayloadMap[T]): VocalDspPayloadMap[T] {
  if (taskType === 'EXTRACT_MELODIC_DATA') {
    const p = payload as ExtractMelodicTaskPayload;
    return { ...p, rawPCM: new Float32Array(p.rawPCM) } as VocalDspPayloadMap[T];
  }
  if (taskType === 'REANALYZE_ALIGNED_SYLLABLES') {
    const p = payload as VocalDspPayloadMap['REANALYZE_ALIGNED_SYLLABLES'];
    return { items: p.items.map((it) => ({ ...it, pcm: it.pcm ? new Float32Array(it.pcm) : it.pcm })) } as VocalDspPayloadMap[T];
  }
  const p = payload as RenderVoiceTaskPayload | EncodeWavTaskPayload;
  return { ...p, pcm: new Float32Array(p.pcm) } as VocalDspPayloadMap[T];
}

export function dispatchVocalDspTask<T extends VocalDspTaskType>(
  taskType: T, payload: VocalDspPayloadMap[T], options?: VocalDspCallOptions
): Promise<VocalDspResultMap[T]> {
  const requestId = `vdsp_${++requestSeq}_${Date.now()}`, dedupeKey = options?.dedupeKey;
  if (dedupeKey) {
    const prevId = activeByDedupeKey.get(dedupeKey);
    if (prevId) {
      const prev = pendingMap.get(prevId);
      if (prev) { pendingMap.delete(prevId); const cancelErr: VocalDspCancelledError = { cancelled: true, requestId: prevId, dedupeKey }; prev.reject(cancelErr); }
    }
    activeByDedupeKey.set(dedupeKey, requestId);
  }
  return new Promise<VocalDspResultMap[T]>((resolve, reject) => {
    pendingMap.set(requestId, { requestId, dedupeKey, resolve, reject });
    notifyBusy();
    const worker = getOrCreateWorker();
    if (worker) {
      const req: VocalDspWorkerRequest<T> = { requestId, taskType, payload };
      // RÈGLE MÉMOIRE CRITIQUE : aucun ArrayBuffer source n'est passé en Transferable à l'aller !
      worker.postMessage(req);
      return;
    }
    queueMicrotask(() => {
      const entry = pendingMap.get(requestId);
      if (!entry) return;
      pendingMap.delete(requestId);
      if (dedupeKey && activeByDedupeKey.get(dedupeKey) === requestId) activeByDedupeKey.delete(dedupeKey);
      notifyBusy();
      try { entry.resolve(runVocalDspTask(taskType, cloneNodeFallbackPayload(taskType, payload))); }
      catch (err) { entry.reject(err); }
    });
  });
}

export function extractMelodicDataInWorker(params: ExtractMelodicTaskPayload, options?: VocalDspCallOptions): Promise<ExtractMelodicTaskResult> {
  const vocalBounds = params.vocalBounds ?? getEffectiveVocalBounds(params.tessitura);
  return dispatchVocalDspTask('EXTRACT_MELODIC_DATA', { ...params, vocalBounds }, options);
}

export function reanalyzeSyllablesInWorker(items: Array<Omit<ReanalyzeSyllablesBatchItem, 'allowedPitchClasses'> & { allowedPitchClasses?: Set<number> | number[] | null }>, options?: VocalDspCallOptions): Promise<ReanalyzeSyllablesTaskResult> {
  const normItems: ReanalyzeSyllablesBatchItem[] = items.map((it) => ({
    ...it,
    vocalBounds: it.vocalBounds ?? getEffectiveVocalBounds(it.tessitura),
    allowedPitchClasses: it.allowedPitchClasses instanceof Set ? Array.from(it.allowedPitchClasses) : (it.allowedPitchClasses ?? null),
  }));
  return dispatchVocalDspTask('REANALYZE_ALIGNED_SYLLABLES', { items: normItems }, options);
}

export function renderVoiceDspInWorker(payload: RenderVoiceTaskPayload, options?: VocalDspCallOptions): Promise<RenderVoiceTaskResult> {
  return dispatchVocalDspTask('RENDER_CORRECTED_OR_SHIFTED_VOICE', payload, options);
}

export function encodeWavInWorker(payload: EncodeWavTaskPayload, options?: VocalDspCallOptions): Promise<EncodeWavTaskResult> {
  return dispatchVocalDspTask('ENCODE_WAV', payload, options);
}
