/**
 * AuthUserButton.tsx
 * Bouton Cordel d'authentification Google Auth / SSO Organizador (< 80 lignes).
 */
import React from 'react';
import type { User } from 'firebase/auth';
import { LogIn, LogOut, Loader2, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AuthUserButtonProps {
  currentUser: User | null;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const AuthUserButton: React.FC<AuthUserButtonProps> = ({
  currentUser,
  isLoading,
  onLogin,
  onLogout,
}) => {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="h-9 px-2.5 cordel-card-sm flex items-center justify-center bg-black/40 text-stone-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={onLogin}
        title={t('authLoginTooltip') || 'Se connecter avec Google / SSO Organizador'}
        className="h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>{t('authLogin') || 'Connexion'}</span>
      </button>
    );
  }

  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Adhérent';

  return (
    <div className="h-9 px-2 cordel-card-sm flex items-center gap-2 bg-black/40 text-theme-ink text-xs font-mono">
      <div className="flex items-center gap-1.5 max-w-[120px] truncate" title={currentUser.email || displayName}>
        {currentUser.photoURL ? (
          <img src={currentUser.photoURL} alt="" className="w-4 h-4 rounded-full border border-stone-600" />
        ) : (
          <UserIcon className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="truncate text-[11px] font-bold text-stone-200">{displayName}</span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        title={t('authLogout') || 'Déconnexion'}
        className="p-1 hover:bg-black/50 text-stone-400 hover:text-red-400 rounded-none cursor-pointer transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
