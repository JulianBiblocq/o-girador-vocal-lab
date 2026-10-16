/**
 * maracatuVocalPostureTips.ts
 * Fiches conseils de posture corporelle et vocale pour le chant de Maracatu.
 * Strictement < 150 lignes.
 */

export interface PostureTip {
  id: string;
  icon: string;
  titleFr: string;
  titleBr: string;
  descFr: string;
  descBr: string;
}

export const MARACATU_POSTURE_TIPS: PostureTip[] = [
  {
    id: 'ancrage_sol',
    icon: '🦶',
    titleFr: '1. L\'Ancrage au sol (Pés na terra)',
    titleBr: '1. Enraizamento no chão (Pés na terra)',
    descFr: 'Pieds écartés de la largeur du bassin, genoux déverrouillés. Ressens le poids qui descend dans le sol pour soutenir ta projection sans crisper la gorge.',
    descBr: 'Pés na largura do quadril, joelhos destravados. Sinta o peso descendo para o chão para apoiar a projeção sem tensionar a garganta.',
  },
  {
    id: 'peito_aberto',
    icon: '🫁',
    titleFr: '2. L\'Ouverture thoracique (Peito aberto)',
    titleBr: '2. Abertura torácica (Peito aberto)',
    descFr: 'Poitrine fière sans cambrer, épaules détendues vers l\'arrière. Laisse vibrer le sternum pour enrichir les harmoniques médiums du chant.',
    descBr: 'Peito erguido sem arquear as costas, ombros relaxados para trás. Deixe o esterno ressoar para enriquecer os harmônicos da voz.',
  },
  {
    id: 'regard_horizon',
    icon: '👀',
    titleFr: '3. La Nuque libre & Regard lointain (Olhar no horizonte)',
    titleBr: '3. Nuca livre & Olhar no horizonte (Olhar no horizonte)',
    descFr: 'Tête en équilibre doux au sommet de la colonne, menton détendu. Projette ton regard vers l\'horizon comme pour appeler la communauté au loin.',
    descBr: 'Cabeça em equilíbrio no topo da coluna, queixo relaxado. Projete o olhar no horizonte como quem chama a comunidade de longe.',
  },
  {
    id: 'boca_concha',
    icon: '👄',
    titleFr: '4. Mâchoire souple & Pavillon (Boca em concha)',
    titleBr: '4. Mandíbula solta & Pavilhão (Boca em concha)',
    descFr: 'Ouverture verticale généreuse de la bouche, mâchoire détendue. Les voyelles ouvertes du Maracatu doivent résonner en porte-voix naturel.',
    descBr: 'Abertura vertical ampla da boca, mandíbula solta. As vogais abertas do Maracatu precisam ressoar como um megafone natural.',
  },
];
