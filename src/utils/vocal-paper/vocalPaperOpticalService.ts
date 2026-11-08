/**
 * vocalPaperOpticalService.ts
 * Service de lecture optique multi-photos pour l'Atelier Papier du Chant (< 130 lignes).
 * Fusionne un lot de photos (Séquence + Feuilles Patterns Notes / Rythme) en VocalPaperBatchScanResult.
 */
import type {
  VocalPaperBatchScanResult,
  ScannedVocalPatternBlock,
  ScannedSequenceMeasureColumn,
  VocalSheetOpticalCode,
} from '../../types/vocalPaperWorkshop.types';
import { buildVocalPaperOpticalSystemPrompt } from './vocalPaperOpticalPrompt';

const STORAGE_KEY = 'girador_gemini_api_key';
export const OPTICAL_SCAN_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;

export function getStoredOpticalApiKey(): string | null {
  const env = (import.meta as any)?.env;
  const envKey = env?.VITE_GEMINI_API_KEY || env?.GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
  try {
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY)?.trim() : null;
    if (local) return local;
  } catch {}
  return env?.VITE_FIREBASE_API_KEY && typeof env.VITE_FIREBASE_API_KEY === 'string'
    ? env.VITE_FIREBASE_API_KEY.trim()
    : null;
}

export function saveStoredOpticalApiKey(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function parseAndNormalizeOpticalBatchJson(rawText: string): VocalPaperBatchScanResult {
  const cleaned = (rawText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned || '{}');

  const seqCols: ScannedSequenceMeasureColumn[] = Array.isArray(parsed.sequenceColumns)
    ? parsed.sequenceColumns.map((c: any, idx: number) => ({
        measureNumber: Number(c.measureNumber || idx + 1),
        puxCode: c.puxCode ? String(c.puxCode).trim().toUpperCase() : null,
        corCode: c.corCode ? String(c.corCode).trim().toUpperCase() : null,
      }))
    : [];

  const patterns: ScannedVocalPatternBlock[] = Array.isArray(parsed.patterns)
    ? parsed.patterns.map((p: any, idx: number) => {
        const sheetCode: VocalSheetOpticalCode = p.sheetCode || (p.rhythmOnlyMode ? 'CHANT-RYTHME' : 'CHANT-NOTES-1M');
        return {
          code: String(p.code || `P${idx + 1}`).trim().toUpperCase(),
          name: p.name ? String(p.name).trim() : undefined,
          sheetCode,
          measuresCount: (Math.min(4, Math.max(1, Number(p.measuresCount || (sheetCode === 'CHANT-NOTES-2M' ? 2 : 1)))) as 1 | 2 | 3 | 4),
          hasAnacrusis: Boolean(p.hasAnacrusis || (Array.isArray(p.anacrusisCells) && p.anacrusisCells.length > 0)),
          hasTailBeat: Boolean(p.hasTailBeat || (Array.isArray(p.tailCells) && p.tailCells.length > 0)),
          rhythmOnlyMode: Boolean(p.rhythmOnlyMode || sheetCode === 'CHANT-RYTHME'),
          anacrusisCells: Array.isArray(p.anacrusisCells) ? p.anacrusisCells : [],
          mainCells: Array.isArray(p.mainCells) ? p.mainCells : [],
          tailCells: Array.isArray(p.tailCells) ? p.tailCells : [],
        };
      })
    : [];

  return {
    title: parsed.title ? String(parsed.title).trim() : undefined,
    bpm: parsed.bpm ? Number(parsed.bpm) : undefined,
    timeSignature: parsed.timeSignature || '4/4',
    sungKey: parsed.sungKey ? String(parsed.sungKey).trim() : undefined,
    troupeKey: parsed.troupeKey ? String(parsed.troupeKey).trim() : undefined,
    scaleMode: parsed.scaleMode || undefined,
    sequenceColumns: seqCols,
    patterns,
    detectedSheetCodes: Array.isArray(parsed.detectedSheetCodes) ? parsed.detectedSheetCodes : [],
  };
}

export async function analyzeVocalPaperPhotoBatch(
  imageDataUrls: string[],
  options?: { referenceLyrics?: string; defaultBpm?: number; defaultTimeSignature?: string; customApiKey?: string }
): Promise<{ success: boolean; result?: VocalPaperBatchScanResult; error?: string; needsApiKey?: boolean }> {
  if (!imageDataUrls || imageDataUrls.length === 0) {
    return { success: false, error: 'Aucune photo sélectionnée.' };
  }
  const apiKey = options?.customApiKey?.trim() || getStoredOpticalApiKey();
  if (!apiKey) {
    return { success: false, error: "Clé d'accès requise pour le service de lecture optique.", needsApiKey: true };
  }

  const prompt = buildVocalPaperOpticalSystemPrompt(options);
  const imageParts = imageDataUrls.map((url) => ({
    inline_data: {
      mime_type: url.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg',
      data: url.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const payload = {
    contents: [{ parts: [{ text: prompt }, ...imageParts] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1, maxOutputTokens: 8192 },
  };

  let lastError = 'Format non reconnu';
  for (const model of OPTICAL_SCAN_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        lastError = res.status === 429 ? 'Quota journalier atteint sur cette clé.' : `Erreur HTTP ${res.status}`;
        continue;
      }
      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const result = parseAndNormalizeOpticalBatchJson(rawText);
      return { success: true, result };
    } catch (err: any) {
      lastError = err?.message || 'Erreur réseau';
    }
  }
  return { success: false, error: `Échec de la lecture optique : ${lastError}` };
}
