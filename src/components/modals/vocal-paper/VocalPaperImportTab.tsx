/**
 * VocalPaperImportTab.tsx
 * Onglet « Photographier / Importer mes Feuilles (Multi-pages) » de l'Atelier Papier du Chant (< 130 lignes).
 * File d'attente multi-photos, détection des 4 coins ■, lecture optique et synchronisation Organizador / Sequenciador.
 */
import React, { useRef, useState } from 'react';
import { Camera, Plus, Trash2, CheckCircle2, RefreshCw, Key, Upload } from 'lucide-react';
import type { VocalPaperPhotoQueueItem, VocalPaperBatchScanResult } from '../../../types/vocalPaperWorkshop.types';
import type { ToadaProject } from '../../../types/toadaProject.types';
import { preprocessVocalPaperPhoto } from '../../../utils/vocal-paper/vocalPaperImagePreprocessor';
import { analyzeVocalPaperPhotoBatch, getStoredOpticalApiKey, saveStoredOpticalApiKey } from '../../../utils/vocal-paper/vocalPaperOpticalService';
import { convertVocalPaperScanToProject } from '../../../utils/vocal-paper/vocalPaperToProjectConverter';
import { publishToadaToOrganizador } from '../../../services/organizadorToadaPublisher';
import { publishToadaToSequencer } from '../../../services/cloudToadaPublisher';
import { resolveProjectDualScale } from '../../../utils/scaleTranspositionHelper';

export interface VocalPaperImportTabProps {
  project: ToadaProject;
  groupId?: string | null;
  isBr?: boolean;
  onProjectImported: (updated: ToadaProject) => void;
}

export const VocalPaperImportTab: React.FC<VocalPaperImportTabProps> = ({ project, groupId, isBr = false, onProjectImported }) => {
  const dual = resolveProjectDualScale(project, isBr ? 'br' : 'fr');
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<VocalPaperPhotoQueueItem[]>([]);
  const [title, setTitle] = useState(project.title || 'Vovó falou');
  const [bpm, setBpm] = useState(project.bpm || 85);
  const [sungKey, setSungKey] = useState(dual.sungScaleLabel || 'Do Majeur');
  const [troupeKey, setTroupeKey] = useState(dual.troupeScaleLabel || 'Do Majeur');
  const [syncOrganizador, setSyncOrganizador] = useState(false);
  const [syncSequenciador, setSyncSequenciador] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VocalPaperBatchScanResult | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(() => !getStoredOpticalApiKey());
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredOpticalApiKey() || '');

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    const added: VocalPaperPhotoQueueItem[] = [];
    for (const file of fileList) {
      const prep = await preprocessVocalPaperPhoto(file);
      added.push({
        id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, fileName: file.name,
        rawDataUrl: prep.processedDataUrl, processedDataUrl: prep.processedDataUrl,
        detectedCornerCount: prep.detectedCornerCount, detectedOrientation: prep.detectedOrientation, status: 'ready',
      });
    }
    setPhotos((prev) => [...prev, ...added]); setErrorMsg(null); e.target.value = '';
  };

  const handleRunOpticalScan = async () => {
    if (photos.length === 0) return;
    if (apiKeyDraft.trim()) saveStoredOpticalApiKey(apiKeyDraft.trim());
    setIsScanning(true); setErrorMsg(null);
    setStatusMsg(isBr ? 'Leitura óptica das folhas em curso...' : 'Lecture optique des feuilles manuscrites en cours...');
    const res = await analyzeVocalPaperPhotoBatch(photos.map((p) => p.processedDataUrl), {
      defaultBpm: bpm, defaultTimeSignature: project.timeSignature || '4/4', customApiKey: apiKeyDraft.trim() || undefined,
    });
    setIsScanning(false);
    if (!res.success || !res.result) {
      setErrorMsg(res.error || 'Lecture optique impossible');
      if (res.needsApiKey) setShowKeyInput(true);
      setStatusMsg(null); return;
    }
    setScanResult(res.result);
    if (res.result.title) setTitle(res.result.title);
    if (res.result.bpm) setBpm(res.result.bpm);
    if (res.result.sungKey) setSungKey(res.result.sungKey);
    if (res.result.troupeKey) setTroupeKey(res.result.troupeKey);
    setStatusMsg(`✓ ${res.result.patterns.length} pattern(s) & ${res.result.sequenceColumns.length} mesure(s) lus.`);
  };

  const handleApplyToProject = async () => {
    if (!scanResult) return;
    setIsScanning(true);
    const updated = convertVocalPaperScanToProject(project, scanResult, { title, bpm, sungKey, troupeKey });
    if (syncOrganizador) await publishToadaToOrganizador(updated, groupId || 'samambaia').catch(() => {});
    if (syncSequenciador) await publishToadaToSequencer(updated, undefined, bpm).catch(() => {});
    setIsScanning(false);
    onProjectImported(updated);
  };

  return (
    <div className="space-y-3 text-xs font-mono">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 cordel-card-sm p-2.5 rounded">
        <label className="flex flex-col gap-0.5"><span className="font-bold text-[10px]">TITRE TOADA</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="px-2 py-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] font-bold" /></label>
        <label className="flex flex-col gap-0.5"><span className="font-bold text-[10px]">TEMPO (BPM)</span><input type="number" min={35} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 85)} className="px-2 py-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] font-bold" /></label>
        <label className="flex flex-col gap-0.5"><span className="font-bold text-[10px]">CHANTÉ EN</span><input value={sungKey} onChange={(e) => setSungKey(e.target.value)} className="px-2 py-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] font-bold" /></label>
        <label className="flex flex-col gap-0.5"><span className="font-bold text-[10px]">TONALITÉ TROUPE</span><input value={troupeKey} onChange={(e) => setTroupeKey(e.target.value)} className="px-2 py-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] font-bold" /></label>
      </div>

      <div className="p-3 rounded border-2 border-dashed border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold">{isBr ? `Lote de Fotos (${photos.length} folha(s))` : `Lot de Photos (${photos.length} feuille(s) : Séquence + Patterns)`}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setShowKeyInput((v) => !v)} className="px-2 py-1 cordel-btn rounded font-bold flex items-center gap-1 cursor-pointer"><Key className="w-3.5 h-3.5" /><span>{isBr ? 'Chave óptica' : 'Clé optique'}</span></button>
            <button type="button" onClick={() => fileRef.current?.click()} className="px-2.5 py-1 rounded bg-[#9a3412] text-white font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /><span>{isBr ? 'Adicionar foto(s)' : 'Ajouter photo(s)'}</span></button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleAddFiles} className="hidden" />
          </div>
        </div>
        {showKeyInput && (
          <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/40">
            <span className="font-bold shrink-0">{isBr ? 'Chave óptica :' : 'Clé du service optique :'}</span>
            <input type="password" value={apiKeyDraft} onChange={(e) => setApiKeyDraft(e.target.value)} placeholder="Clé d'accès..." className="flex-1 px-2 py-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-surface)]" />
            <button type="button" onClick={() => { saveStoredOpticalApiKey(apiKeyDraft); setShowKeyInput(false); }} className="px-2.5 py-1 cordel-btn rounded font-bold cursor-pointer">OK</button>
          </div>
        )}
        {photos.length === 0 ? (
          <div onClick={() => fileRef.current?.click()} className="py-4 text-center opacity-75 cursor-pointer hover:opacity-100"><Camera className="w-6 h-6 mx-auto mb-1 text-[#9a3412] dark:text-amber-300" /><div className="font-bold">{isBr ? 'Clique para fotografar ou selecionar as folhas (Sequência + Padrões P1..Pn)' : 'Cliquez pour photographier ou sélectionner vos feuilles (Séquence + Patterns P1..Pn)'}</div></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {photos.map((ph, idx) => (
              <div key={ph.id} className="p-1.5 rounded border border-[var(--cordel-border-sub)] bg-black/5 flex flex-col gap-1">
                <img src={ph.processedDataUrl} alt={ph.fileName} className="h-18 w-full object-cover rounded border border-black/20" />
                <div className="flex items-center justify-between text-[10px] font-bold"><span>Page {idx + 1} ({ph.detectedCornerCount}/4 ■)</span><button type="button" onClick={() => setPhotos((p) => p.filter((x) => x.id !== ph.id))} className="text-red-600 hover:text-red-800 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 cordel-card-sm p-2.5 rounded">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={syncOrganizador} onChange={(e) => setSyncOrganizador(e.target.checked)} className="accent-[#9a3412]" /><span>Sync Organizador</span></label>
          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={syncSequenciador} onChange={(e) => setSyncSequenciador(e.target.checked)} className="accent-[#9a3412]" /><span>Sync Sequenciador</span></label>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={photos.length === 0 || isScanning} onClick={handleRunOpticalScan} className="px-3 py-1.5 rounded cordel-btn font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} /><span>{isBr ? 'Ler manuscrito' : 'Lire le manuscrit'}</span></button>
          {scanResult && <button type="button" disabled={isScanning} onClick={handleApplyToProject} className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"><Upload className="w-3.5 h-3.5" /><span>{isBr ? 'Aplicar ao projeto' : 'Injecter dans le projet'}</span></button>}
        </div>
      </div>
      {statusMsg && <div className="p-2 rounded bg-emerald-500/15 border border-emerald-600/40 text-emerald-900 dark:text-emerald-200 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{statusMsg}</span></div>}
      {errorMsg && <div className="p-2 rounded bg-red-500/15 border border-red-600/40 text-red-800 dark:text-red-200 font-bold">{errorMsg}</div>}
    </div>
  );
};