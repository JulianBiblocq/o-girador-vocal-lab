/**
 * SlicerRoleSessionBar.tsx
 * Barre explicite d'import par rôle (Puxador / Coro), commutation entre les 2 buffers maîtres
 * en session, badge de conservation des blocs déjà découpés et bandeau d'enchaînement guidé (< 115 lignes).
 */
import React from 'react';
import type { VocalRole } from '../../types/toadaProject.types';
import type { RoleReadinessCounts } from '../../utils/slicerSessionStore';
import { Check, FolderOpen } from 'lucide-react';

export interface PostAssignBannerState {
  assignedRole: VocalRole;
  assignedCount: number;
  nextRole: VocalRole;
}

export interface SlicerRoleSessionBarProps {
  activeRole: VocalRole;
  counts: RoleReadinessCounts;
  hasPuxadorMaster: boolean;
  hasCoroMaster: boolean;
  postAssignBanner?: PostAssignBannerState | null;
  onSelectRoleSession: (role: VocalRole) => void;
  onLoadRoleFile: (role: VocalRole) => void;
  onCloseModal?: () => void;
}

export const SlicerRoleSessionBar: React.FC<SlicerRoleSessionBarProps> = ({
  activeRole, counts, hasPuxadorMaster, hasCoroMaster, postAssignBanner,
  onSelectRoleSession, onLoadRoleFile, onCloseModal,
}) => {
  const { puxRecordedCount, puxTotalCount, coroRecordedCount, coroTotalCount } = counts;

  return (
    <div className="flex flex-col gap-2">
      {postAssignBanner && (
        <div className="p-2.5 rounded border-2 border-emerald-600/80 bg-emerald-950/20 dark:bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-xs">
          <span className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>Les {postAssignBanner.assignedCount} blocs {postAssignBanner.assignedRole === 'puxador' ? 'Puxador' : 'Coro'} sont découpés et sauvegardés !</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {postAssignBanner.nextRole === 'coro' ? (
              <button type="button" onClick={() => onLoadRoleFile('coro')} className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-black cursor-pointer flex items-center gap-1.5 shadow-xs">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Importer maintenant le fichier du Chœur (Coro)</span>
              </button>
            ) : (
              <button type="button" onClick={() => onLoadRoleFile('puxador')} className="px-3 py-1.5 rounded bg-[#9a3412] hover:bg-[#b43e18] text-white font-black cursor-pointer flex items-center gap-1.5 shadow-xs">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Importer maintenant le fichier du Puxador</span>
              </button>
            )}
            {onCloseModal && (
              <button type="button" onClick={onCloseModal} className="px-2.5 py-1.5 rounded cordel-card-sm hover:bg-stone-500/20 font-bold cursor-pointer flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" /><span>Terminer et fermer</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(hasPuxadorMaster || hasCoroMaster) && (
            <div className="inline-flex items-center border border-[var(--cordel-border-sub)] rounded overflow-hidden text-[11px] font-mono mr-1">
              <button type="button" onClick={() => onSelectRoleSession('puxador')} className={`h-7 px-2.5 font-bold cursor-pointer transition-colors ${activeRole === 'puxador' ? 'bg-[#9a3412] text-white' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/75 hover:opacity-100'}`} title="Afficher le banc de découpe du Puxador">
                Puxador {hasPuxadorMaster ? '●' : ''}
              </button>
              <button type="button" onClick={() => onSelectRoleSession('coro')} className={`h-7 px-2.5 font-bold cursor-pointer transition-colors border-l border-[var(--cordel-border-sub)] ${activeRole === 'coro' ? 'bg-emerald-700 text-white' : 'bg-[var(--cordel-subcard-bg)] text-theme-ink/75 hover:opacity-100'}`} title="Afficher le banc de découpe du Coro">
                Coro {hasCoroMaster ? '●' : ''}
              </button>
            </div>
          )}

          <button type="button" onClick={() => onLoadRoleFile('puxador')} className={`h-7 px-2.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${activeRole === 'puxador' ? 'bg-[#9a3412]/15 border-[#9a3412] text-[#9a3412] dark:text-amber-300' : 'cordel-card-sm text-theme-ink hover:border-[#9a3412]'}`} title="Choisir un fichier audio maître pour le Puxador et pré-assigner automatiquement les blocs Puxador">
            <FolderOpen className="w-3.5 h-3.5" /><span>Charger fichier Puxador ({puxRecordedCount}/{puxTotalCount} prêts)</span>
          </button>

          <button type="button" onClick={() => onLoadRoleFile('coro')} className={`h-7 px-2.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${activeRole === 'coro' ? 'bg-emerald-700/15 border-emerald-700 text-emerald-800 dark:text-emerald-300' : 'cordel-card-sm text-theme-ink hover:border-emerald-700'}`} title="Choisir un fichier audio maître pour le Chœur (Coro) et pré-assigner automatiquement les blocs Coro">
            <FolderOpen className="w-3.5 h-3.5" /><span>Charger fichier Coro ({coroRecordedCount}/{coroTotalCount} prêts)</span>
          </button>
        </div>

        {activeRole === 'coro' && puxRecordedCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-bold">
            ✓ Les {puxRecordedCount} blocs Puxador déjà découpés sont conservés
          </span>
        )}
        {activeRole === 'puxador' && coroRecordedCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-emerald-700/15 border border-emerald-600/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-bold">
            ✓ Les {coroRecordedCount} blocs Coro déjà découpés sont conservés
          </span>
        )}
      </div>
    </div>
  );
};
