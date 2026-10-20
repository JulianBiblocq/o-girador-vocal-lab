/**
 * UserAvatarMenu.tsx
 * Avatar profil utilisateur rond Cordel et menu déroulant Auth (< 80 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import { useOrganizadorAuth } from '../../hooks/useOrganizadorAuth';
import { useLanguage } from '../../i18n/LanguageContext';
import { User as UserIcon, LogOut, LogIn, Loader2, Smartphone } from 'lucide-react';

interface UserAvatarMenuProps {
  isInstalled?: boolean;
  onInstall?: () => void;
}

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({ isInstalled = false, onInstall }) => {
  const { currentUser, groupId, isLoading, loginWithGoogle, logout } = useOrganizadorAuth();
  const { t, locale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-9 h-9 rounded-full cordel-card-sm flex items-center justify-center bg-[var(--cordel-subcard-bg)] text-[var(--cordel-secondary-text)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '';
  const groupLabel = groupId ? groupId.charAt(0).toUpperCase() + groupId.slice(1).toLowerCase() : '';

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={currentUser ? displayName : (t('authLogin') || 'Connexion')}
        className="w-9 h-9 rounded-full overflow-hidden border border-[var(--cordel-border-sub)] shadow-sm cursor-pointer flex items-center justify-center bg-[var(--cordel-subcard-bg)] hover:opacity-90 transition-opacity"
      >
        {currentUser?.photoURL ? (
          <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
        ) : currentUser ? (
          <span className="font-bold text-xs text-theme-ink font-mono">{initial}</span>
        ) : (
          <UserIcon className="w-4 h-4 text-theme-ink opacity-70" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-11 right-0 z-[100] w-56 cordel-card p-2.5 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-2 text-xs font-mono rounded">
          {!isInstalled && onInstall && (
            <button
              type="button"
              onClick={() => { setIsOpen(false); onInstall(); }}
              className="w-full p-1.5 flex items-center gap-2 text-[var(--cordel-accent-text)] hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer border border-[var(--cordel-border-sub)]"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="font-bold">{t('pwaInstallBtn') || (locale === 'br' ? 'Instalar' : 'Installer')}</span>
            </button>
          )}
          {currentUser ? (
            <>
              <div className="flex flex-col gap-0.5 pb-2 border-b border-[var(--cordel-border-sub)]">
                <span className="font-bold truncate text-[11px]">{displayName}</span>
                <span className="text-[10px] opacity-70 truncate">{currentUser.email}</span>
                {groupLabel && (
                  <span className="text-[10px] text-[var(--cordel-accent-text)] font-semibold mt-0.5">
                    Groupe : {groupLabel}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setIsOpen(false); logout(); }}
                className="w-full p-1.5 flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-[var(--cordel-subcard-bg)] rounded transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="font-bold">{t('authLogout') || 'Se déconnecter'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setIsOpen(false); loginWithGoogle(); }}
              className="w-full p-2 flex items-center justify-center gap-2 cordel-btn-primary font-bold cursor-pointer rounded"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('authLogin') || 'Se connecter'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
