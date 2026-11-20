/**
 * takeRecoveryBatchInfo.ts
 * Utilitaires purs de la récupération : regroupement des fichiers Storage par lot (préfixe + date) et durée exacte
 * depuis l'en-tête RIFF/WAVE (repli : estimation 48 kHz mono 16 bits) (< 80 lignes).
 */
export interface WavHeaderInfo { sampleRate: number; channels: number; bits: number; dataBytes: number; durationSec: number; }

export function parseBatchInfo(fileName: string, updatedIso?: string): { batchKey: string; batchLabel: string } {
  const day = updatedIso ? updatedIso.slice(0, 10) : '';
  const fmtDay = day ? day.split('-').reverse().join('/') : '';
  const pat = /^(.+?)_(pat-[a-z0-9]+)-[a-z0-9]+\.\w+$/i.exec(fileName);
  if (pat) return { batchKey: `${pat[1]}/${pat[2]}/${day}`, batchLabel: `${pat[2]} • ${fmtDay}` };
  const legacy = /^(\d+)(?:_\d+)?\.\w+$/.exec(fileName);
  if (legacy) return { batchKey: `legacy/${legacy[1]}/${day}`, batchLabel: `${legacy[1]} • ${fmtDay}` };
  return { batchKey: `other/${day}`, batchLabel: `autres • ${fmtDay}` };
}

export function estimateWavDurationFromSize(sizeBytes: number, sampleRate = 48000, channels = 1, bits = 16): number {
  return Math.max(0, (sizeBytes - 44) / (sampleRate * channels * (bits / 8)));
}

export function parseWavHeader(bytes: Uint8Array, fileSizeBytes: number): WavHeaderInfo | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let offset = 12, sampleRate = 0, channels = 0, bits = 0;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset), size = view.getUint32(offset + 4, true);
    if (id === 'fmt ' && offset + 24 <= bytes.length) {
      channels = view.getUint16(offset + 10, true); sampleRate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      if (!sampleRate || !channels || !bits) return null;
      const dataBytes = Math.max(0, Math.min(size, fileSizeBytes - offset - 8));
      return { sampleRate, channels, bits, dataBytes, durationSec: dataBytes / (sampleRate * channels * (bits / 8)) };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}
