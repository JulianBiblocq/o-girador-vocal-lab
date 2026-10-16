/**
 * ToadaSheetModal.tsx
 * Modale Cordel d'importation des Fiches ToadaDocument d'organizador (< 135 lignes).
 * Gère chargement JSON, collage riche HTML/Markdown, convention de gras et génération automatique.
 */
import React, { useState, useRef } from 'react';
import type { VocalRole } from '../../types/toadaProject.types';
import type { ToadaDocument, ParsedToadaSheetResult } from '../../types/toadaDocument.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { parseToadaJsonOrText, parseToadaDocument } from '../../utils/toadaSheetParser';
import { generateToadaFromSheet } from '../../utils/toadaConductorGenerator';
import { ToadaSheetPreviewList } from './ToadaSheetPreviewList';
import { X, Upload, Sparkles, ArrowRightLeft } from 'lucide-react';

export const ToadaSheetModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { project, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState('');
  const [boldRole, setBoldRole] = useState<VocalRole>('coro');
  const [jsonDocs, setJsonDocs] = useState<ToadaDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [parsed, setParsed] = useState<ParsedToadaSheetResult>({ segments: [] });

  const handleApplyText = (input: string, role: VocalRole) => {
    setRawText(input);
    const res = parseToadaJsonOrText(input, role);
    if (res.isJsonArray && res.docs.length > 0) {
      setJsonDocs(res.docs); setSelectedDocId(res.docs[0].id);
      setParsed(parseToadaDocument(res.docs[0], role));
    } else {
      setJsonDocs(res.docs); setSelectedDocId(res.docs[0]?.id || '');
      setParsed(res.parsed);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleApplyText(ev.target?.result as string || '', boldRole);
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    const found = jsonDocs.find((d) => d.id === docId);
    if (found) setParsed(parseToadaDocument(found, boldRole));
  };

  const handleToggleConvention = () => {
    const nextRole: VocalRole = boldRole === 'coro' ? 'puxador' : 'coro';
    setBoldRole(nextRole);
    if (jsonDocs.length > 0 && selectedDocId) {
      const doc = jsonDocs.find((d) => d.id === selectedDocId);
      if (doc) setParsed(parseToadaDocument(doc, nextRole));
    } else handleApplyText(rawText, nextRole);
  };

  const handleInvertAllRoles = () => {
    setParsed((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => ({ ...s, role: s.role === 'puxador' ? 'coro' : 'puxador' })),
    }));
  };

  const handleGenerate = () => {
    if (parsed.segments.length === 0) return;
    const updated = generateToadaFromSheet(project, parsed);
    loadProject(updated);
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
      <div className="w-full max-w-2xl cordel-card bg-theme-bg border-2 border-stone-900 shadow-[6px_6px_0px_#1a1a1a] flex flex-col gap-3 p-4 text-theme-ink max-h-[92vh] overflow-y-auto cordel-scrollbar rounded-none">
        <div className="flex items-center justify-between border-b border-[var(--cordel-border)] pb-2">
          <h2 className="text-sm font-black tracking-widest uppercase m-0 text-theme-wood flex items-center gap-2">
            <span>📜</span><span>{t('toadaSheetModalTitle')}</span>
          </h2>
          <button type="button" onClick={onClose} className="p-1 cordel-card-sm hover:bg-stone-800 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-2.5 py-1.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-theme-wood text-[#f4ecd8] hover:bg-theme-wood/90 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /><span>{t('toadaSheetLoadJson')}</span>
          </button>
          {jsonDocs.length > 1 && (
            <select value={selectedDocId} onChange={(e) => handleSelectDoc(e.target.value)} className="px-2 py-1.5 bg-black/50 border border-[var(--cordel-border)] text-xs font-mono text-stone-200 focus:outline-none rounded-none">
              {jsonDocs.map((d) => <option key={d.id} value={d.id}>{d.titre} {d.rythme ? `(${d.rythme})` : ''}</option>)}
            </select>
          )}
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          <button type="button" onClick={handleToggleConvention} className="px-2 py-1.5 cordel-card-sm text-xs font-mono bg-stone-800 text-stone-200 hover:bg-stone-700 cursor-pointer">
            {boldRole === 'coro' ? t('toadaSheetConventionBoldCoro') : t('toadaSheetConventionBoldPuxador')}
          </button>
          <button type="button" onClick={handleInvertAllRoles} title={t('toadaSheetInvertRoles')} className="px-2 py-1.5 cordel-card-sm text-xs font-mono bg-stone-800 text-stone-200 hover:bg-stone-700 flex items-center gap-1 cursor-pointer">
            <ArrowRightLeft className="w-3 h-3" /><span>⇄</span>
          </button>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => handleApplyText(e.target.value, boldRole)}
          onPaste={(e) => {
            const html = e.clipboardData.getData('text/html');
            if (html && /<(strong|b|p|div)/i.test(html)) { e.preventDefault(); handleApplyText(html, boldRole); }
          }}
          placeholder={t('toadaSheetPastePlaceholder')}
          rows={4}
          className="w-full p-2 bg-black/50 border border-[var(--cordel-border)] text-xs font-mono text-stone-200 focus:outline-none cordel-scrollbar rounded-none"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono font-bold text-stone-400">
            {t('toadaSheetPreviewTitle', { n: parsed.segments.length })}
          </span>
          <ToadaSheetPreviewList segments={parsed.segments} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--cordel-border)]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 cordel-card-sm text-xs font-mono hover:bg-stone-800 cursor-pointer">{t('dialogCancel')}</button>
          <button type="button" onClick={handleGenerate} disabled={parsed.segments.length === 0} className="px-3 py-1.5 cordel-btn-primary text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
            <Sparkles className="w-4 h-4 text-amber-300" /><span>{t('toadaSheetGenerateBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
