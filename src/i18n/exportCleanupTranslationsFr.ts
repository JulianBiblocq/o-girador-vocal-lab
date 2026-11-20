/**
 * exportCleanupTranslationsFr.ts
 * Traductions FR pour la modale d'export vers Sequenciador, la mutualisation et le ménage Cloud (< 45 lignes).
 */
import type { ExportCleanupTranslations } from './exportCleanupTranslations.types';

export const exportCleanupTranslationsFr: ExportCleanupTranslations = {
  exportTargetModalTitle: 'Intégrer la Toada dans un morceau — {repLabel}',
  exportTempoSyncBanner: 'Tempo cible : le chant (enregistré à {recBpm} BPM) sera automatiquement calé au tempo du morceau Sequenciador ({seqBpm} BPM)',
  exportModeRhythmNoMidi: 'Rythme & Voix (Sans notes MIDI)',
  exportModeFullWithMidi: 'Complet avec notes MIDI',
  exportTroupeKeyLabel: 'Tonalité Troupe :',
  exportSearchPlaceholder: 'Rechercher dans {repLabel}...',
  exportCreateNewBtn: 'Créer un nouveau morceau ({repLabel})',
  exportNewSongTitleLabel: 'Titre du morceau :',
  exportLinkedToadaBadge: 'Toada associée',
  exportIntegrateConfirmBtn: 'Intégrer dans ce morceau',
  exportStayInCantadorBtn: 'Rester dans Cantador',
  exportOpenInSequenciadorBtn: 'Voir le morceau dans Sequenciador',
  exportDoneBannerTitle: 'Toada intégrée dans « {name} » (calée au tempo Sequenciador : {bpm} BPM) !',
  exportDoneStatsSummary: '{patterns} patterns actifs • {wavs} fichier(s) .wav en ligne • Audio maître {recBpm} ➔ {seqBpm} BPM',
  exportDoneCleanedBadge: '{count} ancien(s) .wav Cloud nettoyé(s)',
  exportMutualizeTitle: 'Phrases répétées à prises distinctes détectées',
  exportMutualizeSub: 'Mutualisez les prises identiques avant l’envoi vers Sequenciador :',
  exportMutualizeOptSingle: 'Garder 1 seule prise (la meilleure)',
  exportMutualizeOptPairAB: 'Garder une paire A + B',
  exportMutualizeOptKeep: 'Conserver séparées ({n})',
  exportMutualizeAdjacentBadge: 'Suite immédiate',
  exportMutualizeOccurrences: '{slots} créneaux • {takes} prises',
  exportPreviewBestTakeTitle: 'Écouter la meilleure prise sélectionnée',
  exportPurgeLocalUnusedLabel: 'Purger aussi les patterns inutilisés en local ({count} • {mb} Mo)',
  exportCloudAutoCleanHint: 'Ménage Cloud automatique : seuls les créneaux actifs sont envoyés et les anciens .wav de cette Toada sont purgés.',
};
