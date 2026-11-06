/**
 * ScaleProposalBanner.tsx
 * Bannière interactive de validation/modification de la gamme détectée sur le chant
 * (Valider & appliquer, Changer Tonique/Mode, Je ne sais pas, Débrayer Mode libre) (< 120 lignes).
 */
import React, { useState, useEffect } from 'react';
import type { ScaleType } from '../../audio/scaleQuantizer';
import {
  SOLFEGE_NOTE_NAMES,
  formatProjectScaleLabel,
  type ProjectScaleAnalysisResult,
} from '../../audio/projectScaleAnalyzer';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { Check, RefreshCw, HelpCircle, Unlock, X } from 'lucide-react';

export interface ScaleProposalBannerProps {
  proposal: ProjectScaleAnalysisResult | null;
  onApplyScale: (tonic: string, scaleType: ScaleType, referencePitch?: string) => void;
  onKeepUncertain?: (tonic: string, scaleType: ScaleType, referencePitch?: string) => void;
  onDisengageFreeMode: () => void;
  onDismiss: () => void;
}

const MODE_OPTIONS: Array<{ key: ScaleType; label: string }> = [
  { key: 'natural_minor', label: 'Mineur (Naturel)' },
  { key: 'major', label: 'Majeur' },
  { key: 'mixolydian', label: 'Mixolydien (Nordeste)' },
  { key: 'dorian', label: 'Dorien' },
  { key: 'pentatonic_minor', label: 'Pentatonique Mineure' },
  { key: 'pentatonic_major', label: 'Pentatonique Majeure' },
];

export const ScaleProposalBanner: React.FC<ScaleProposalBannerProps> = ({
  proposal,
  onApplyScale,
  onKeepUncertain,
  onDisengageFreeMode,
  onDismiss,
}) => {
  const [selectedTonic, setSelectedTonic] = useState(proposal?.tonic || 'A');
  const [selectedMode, setSelectedMode] = useState<ScaleType>(proposal?.scaleType || 'natural_minor');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (proposal) {
      setSelectedTonic(proposal.tonic);
      setSelectedMode(proposal.scaleType);
      setShowPicker(false);
    }
  }, [proposal]);

  if (!proposal) return null;

  const activeLabel = formatProjectScaleLabel(selectedTonic, selectedMode);
  const tonicIdx = (NOTE_NAMES as readonly string[]).indexOf(selectedTonic);
  const tonicSolfege = SOLFEGE_NOTE_NAMES[tonicIdx >= 0 ? tonicIdx : 9] || selectedTonic;
  const octMatch = proposal.referencePitch.match(/(\d+)$/);
  const effectiveRefPitch = `${selectedTonic}${octMatch ? octMatch[1] : '3'}`;

  return (
    <div className="cordel-card p-2.5 rounded border-2 border-amber-500/70 bg-amber-500/10 flex flex-col gap-2 text-xs font-mono shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-amber-900 dark:text-amber-200">
            🎼 Gamme détectée sur vos voix : <strong className="text-theme-accent underline">{activeLabel}</strong> (Tonique : <strong>{tonicSolfege}</strong> • Repère : <strong>{SOLFEGE_NOTE_NAMES[tonicIdx >= 0 ? tonicIdx : 9]}{octMatch ? octMatch[1] : '3'}</strong>)
          </span>
          {proposal.analyzedPatternsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-600/20 text-[10px] font-bold text-amber-800 dark:text-amber-300">
              {proposal.analyzedPatternsCount} phrase{proposal.analyzedPatternsCount > 1 ? 's' : ''} analysée{proposal.analyzedPatternsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button type="button" onClick={onDismiss} className="p-0.5 opacity-60 hover:opacity-100 cursor-pointer" title="Fermer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onApplyScale(selectedTonic, selectedMode, effectiveRefPitch)}
          className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <Check className="w-3.5 h-3.5" />
          <span>✓ Valider et appliquer à tout le chant</span>
        </button>

        <button
          type="button"
          onClick={() => setShowPicker((p) => !p)}
          className="px-2.5 py-1 rounded cordel-btn font-bold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>🔄 Changer ({activeLabel}) ▾</span>
        </button>

        {showPicker && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--cordel-surface)] border border-amber-500/50">
            <select
              value={selectedTonic}
              onChange={(e) => setSelectedTonic(e.target.value)}
              className="cordel-card-sm px-1.5 py-0.5 font-bold rounded cursor-pointer"
            >
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={n}>{SOLFEGE_NOTE_NAMES[i]} ({n})</option>
              ))}
            </select>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as ScaleType)}
              className="cordel-card-sm px-1.5 py-0.5 font-bold rounded cursor-pointer"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => (onKeepUncertain ? onKeepUncertain(selectedTonic, selectedMode, effectiveRefPitch) : onApplyScale(selectedTonic, selectedMode, effectiveRefPitch))}
          className="px-2.5 py-1 rounded cordel-card-sm hover:border-amber-500 font-bold flex items-center gap-1 cursor-pointer"
          title="Garder les 7 notes détectées actives par défaut"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>🤷 Je ne sais pas</span>
        </button>

        <button
          type="button"
          onClick={onDisengageFreeMode}
          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 cursor-pointer"
          title="Débrayer la gamme (Mode libre chromatique sans contrainte)"
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>🔓 Débrayer (Mode libre)</span>
        </button>
      </div>
    </div>
  );
};
