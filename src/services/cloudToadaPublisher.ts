/**
 * cloudToadaPublisher.ts
 * Téléversement des WAV dans Storage et publication du pack Toada dans Firestore pour Sequenciador (< 125 lignes).
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import type { ToadaProject } from '../types/toadaProject.types';

function pcmToWavBlob(pcm: Float32Array, sampleRate: number): Blob {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function getSequenciadorUrl(toadaId: string): string {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const base = isLocal ? 'http://localhost:5174' : 'https://o-girador-sequenciador.web.app';
  return `${base}/?loadToadaId=${encodeURIComponent(toadaId)}`;
}

export async function publishToadaToSequencer(
  project: ToadaProject,
  onProgress?: (stepText: string) => void
): Promise<{ success: boolean; toadaId: string; sequenciadorUrl: string }> {
  const toadaId = project.id;
  const processedPatterns = [];

  for (let i = 0; i < project.patterns.length; i++) {
    const p = project.patterns[i];
    onProgress?.(`Téléversement audio (${i + 1}/${project.patterns.length})...`);
    let audioUrl: string | undefined;

    const variant = p.variants?.[p.activeVariantKey] || Object.values(p.variants || {})[0];
    const pcm = p.correctedAudioSamples || p.rawAudioSamples || variant?.recordingResult?.pcm;
    const sampleRate = variant?.recordingResult?.sampleRate || 44100;

    if (pcm && pcm.length > 0) {
      try {
        const wavBlob = pcmToWavBlob(pcm, sampleRate);
        const storageRef = ref(storage, `vocalRecordings/${toadaId}_${p.id}.wav`);
        await uploadBytes(storageRef, wavBlob, { contentType: 'audio/wav' });
        audioUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn(`[cloudToadaPublisher] Échec upload audio ${p.id} :`, err);
      }
    }

    processedPatterns.push({
      ...p,
      audioUrl,
      variants: {
        ...(p.variants || {}),
        [p.activeVariantKey]: {
          ...variant,
          audioUrl,
        },
      },
    });
  }

  onProgress?.('Enregistrement du pack dans Firestore...');
  const packDoc = {
    id: toadaId,
    title: project.title,
    project: {
      id: project.id,
      title: project.title,
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      measuresCount: (project as any).measuresCount || 2,
      updatedAt: Date.now(),
    },
    metadata: {
      title: project.title,
      toada: project.title,
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      publishedAt: Date.now(),
    },
    patterns: processedPatterns,
    arrangementSlots: project.slots || [],
    slots: project.slots || [],
    createdAt: (project as any).createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, 'toada_packs', toadaId), packDoc);
  const sequenciadorUrl = getSequenciadorUrl(toadaId);
  return { success: true, toadaId, sequenciadorUrl };
}
