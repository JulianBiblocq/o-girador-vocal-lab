/**
 * CordelActionIcons.tsx
 * Icônes SVG monochromes Cordel (trait `currentColor`, aucune couleur codée, zéro emoji) pour la Frise Conducteur,
 * l'installation PWA et la récupération des prises (< 70 lignes).
 */
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const PlusBlockIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg>
);

export const InsertHereIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);

export const PauseBlockIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" strokeDasharray="3 3" /><path d="M10 9v6M14 9v6" /></svg>
);

export const InstallIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></svg>
);

export const RecoverTakeIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5M10 10v4M12 8v8M14 10v4" /></svg>
);

export const ResetAllTakesIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M9.5 9.5l5 5M14.5 9.5l-5 5" /></svg>
);

export const PlayTriangleIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>
);

export const StopSquareIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" /></svg>
);

export const MutualizeTakesIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M4 7h7l3 5-3 5H4M14 12h6M17 9l3 3-3 3" /></svg>
);

export const CheckMarkIcon: React.FC<IconProps> = (p) => (
  <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
