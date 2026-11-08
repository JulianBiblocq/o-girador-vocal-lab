/**
 * vocalPaperOpticalService.ts
 * Service de lecture optique multi-photos pour l'Atelier Papier du Chant (< 142 lignes).
 * Récupère automatiquement la fiche de référence Organizador (sélectionnée ou détectée par titre) et verrouille l'orthographe.
 */
import type {
  VocalPaperBatchScanResult, ScannedVocalPatternBlock, ScannedSequenceMeasureColumn, VocalSheetOpticalCode,
} from '../../types/vocalPaperWorkshop.types';
import type { ToadaDocument } from '../../types/toadaDocument.types';
import { fetchOrganizadorToadas, fetchOrganizadorToadaById } from '../../services/firebaseClient';
import { findDocByIdOrNormalizedTitle } from '../varalSongFilter';
import { buildVocalPaperOpticalSystemPrompt } from './vocalPaperOpticalPrompt';
import { alignScannedPatternsWithOrganizadorLyrics } from './vocalPaperLyricsAligner';

const STORAGE_KEY = 'girador_gemini_api_key';
export const OPTICAL_SCAN_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] as const;

export function getStoredOpticalApiKey(): string | null {
  const env = (import.meta as any)?.env;
  const envKey = env?.VITE_GEMINI_API_KEY || env?.GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
  try {
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY)?.trim() : null;
    if (local) return local;
  } catch {}
  return env?.VITE_FIREBASE_API_KEY && typeof env.VITE_FIREBASE_API_KEY === 'string' ? env.VITE_FIREBASE_API_KEY.trim() : null;
}

export function saveStoredOpticalApiKey(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export async function resolveReferenceOrganizadorDoc(options?: {
  organizadorDoc?: any;
  organizadorDocId?: string;
  organizadorDocsList?: ToadaDocument[];
  candidateTitle?: string;
  groupId?: string | null;
}): Promise<ToadaDocument | null> {
  if (options?.organizadorDoc && typeof options.organizadorDoc === 'object') return options.organizadorDoc;
  const docs = options?.organizadorDocsList?.length ? options.organizadorDocsList : await fetchOrganizadorToadas(options?.groupId).catch(() => []);
  if (options?.organizadorDocId && options.organizadorDocId !== 'auto') {
    const byId = findDocByIdOrNormalizedTitle(docs, options.organizadorDocId);
    if (byId) return byId;
    return fetchOrganizadorToadaById(options.organizadorDocId, options?.groupId, options?.candidateTitle).catch(() => null);
  }
  if (options?.candidateTitle?.trim()) {
    return findDocByIdOrNormalizedTitle(docs, options.candidateTitle.trim()) || null;
  }
  return null;
}

export function parseAndNormalizeOpticalBatchJson(rawText: string, referenceDoc?: any): VocalPaperBatchScanResult {
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
  const rawPatterns: ScannedVocalPatternBlock[] = Array.isArray(parsed.patterns)
    ? parsed.patterns.map((p: any, idx: number) => {
        const sheetCode: VocalSheetOpticalCode = p.sheetCode || (p.rhythmOnlyMode ? 'CHANT-RYTHME' : 'CHANT-NOTES-1M');
        return {
          code: String(p.code || `P${idx + 1}`).trim().toUpperCase(),
          name: p.name ? String(p.name).trim() : undefined, sheetCode,
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
  const patterns = referenceDoc ? alignScannedPatternsWithOrganizadorLyrics(rawPatterns, referenceDoc) : rawPatterns;
  return {
    title: parsed.title ? String(parsed.title).trim() : undefined,
    bpm: parsed.bpm ? Number(parsed.bpm) : undefined, timeSignature: parsed.timeSignature || '4/4',
    sungKey: parsed.sungKey ? String(parsed.sungKey).trim() : undefined,
    troupeKey: parsed.troupeKey ? String(parsed.troupeKey).trim() : undefined,
    scaleMode: parsed.scaleMode || undefined, sequenceColumns: seqCols, patterns,
    detectedSheetCodes: Array.isArray(parsed.detectedSheetCodes) ? parsed.detectedSheetCodes : [],
  };
}

export async function analyzeVocalPaperPhotoBatch(
  imageDataUrls: string[],
  options?: {
    referenceLyrics?: string; organizadorDoc?: any; organizadorDocId?: string; organizadorDocsList?: ToadaDocument[];
    candidateTitle?: string; groupId?: string | null; defaultBpm?: number; defaultTimeSignature?: string; customApiKey?: string;
  }
): Promise<{ success: boolean; result?: VocalPaperBatchScanResult; matchedOrganizadorDoc?: ToadaDocument | null; error?: string; needsApiKey?: boolean }> {
  if (!imageDataUrls?.length) return { success: false, error: 'Aucune photo sélectionnée.' };
  const apiKey = options?.customApiKey?.trim() || getStoredOpticalApiKey();
  if (!apiKey) return { success: false, error: "Clé d'accès requise pour le service de lecture optique.", needsApiKey: true };

  let matchedDoc = await resolveReferenceOrganizadorDoc(options);
  const prompt = buildVocalPaperOpticalSystemPrompt({
    ...options, organizadorDoc: matchedDoc || options?.organizadorDoc,
    referenceLyrics: options?.referenceLyrics || (typeof matchedDoc?.parolesOriginales === 'string' ? matchedDoc.parolesOriginales : matchedDoc?.rawTxtCode),
  });
  const imageParts = imageDataUrls.map((url) => ({
    inline_data: { mime_type: url.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg', data: url.replace(/^data:image\/\w+;base64,/, '') },
  }));
  const payload = { contents: [{ parts: [{ text: prompt }, ...imageParts] }], generationConfig: { response_mime_type: 'application/json', temperature: 0.1, maxOutputTokens: 8192 } };

  let lastError = 'Format non reconnu';
  for (const model of OPTICAL_SCAN_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { lastError = res.status === 429 ? 'Quota journalier atteint sur cette clé.' : `Erreur HTTP ${res.status}`; continue; }
      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const initialResult = parseAndNormalizeOpticalBatchJson(rawText, matchedDoc || options?.referenceLyrics);
      if (!matchedDoc && initialResult.title) {
        matchedDoc = await resolveReferenceOrganizadorDoc({ ...options, organizadorDocId: 'auto', candidateTitle: initialResult.title });
      }
      const finalPatterns = matchedDoc ? alignScannedPatternsWithOrganizadorLyrics(initialResult.patterns, matchedDoc) : initialResult.patterns;
      return {
        success: true, matchedOrganizadorDoc: matchedDoc,
        result: { ...initialResult, patterns: finalPatterns, title: matchedDoc?.titre || initialResult.title, bpm: matchedDoc?.bpmDefaut || initialResult.bpm },
      };
    } catch (err: any) { lastError = err?.message || 'Erreur réseau'; }
  }
  return { success: false, error: `Échec de la lecture optique : ${lastError}` };
}
