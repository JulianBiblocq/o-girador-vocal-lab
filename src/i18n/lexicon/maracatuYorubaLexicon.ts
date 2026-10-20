/**
 * maracatuYorubaLexicon.ts
 * Termes Yoruba, Afro-brésiliens et Spirituels du Maracatu de Baque Virado (< 120 lignes).
 */
import type { LexiconItem } from './lexicon.types';

export const MARACATU_YORUBA_LEXICON: LexiconItem[] = [
  {
    id: 'axe', category: 'yoruba', br: 'Axé',
    fr: 'La force vitale sacrée, énergie et bénédiction',
    phonetique: 'A-ché', conseilDiction: "X prononcé 'ch', accent tonique sur 'é'.", soundCardId: 'x_ch',
    quizQuestion: "Que signifie le terme « Axé » dans la tradition du Maracatu ?",
    quizOptions: ["La force vitale et sacrée", "Un tambour lourd", "Une couronne royale", "Le pas de danse"],
    quizCorrectIndex: 0,
  },
  {
    id: 'xango', category: 'yoruba', br: 'Xangô',
    fr: 'Orixá de la foudre, du feu et de la justice, patron de nombreuses Nations',
    phonetique: 'Chan-gô', conseilDiction: "X prononcé 'ch', 'ô' fermé et résonant en fond de gorge.", soundCardId: 'x_ch',
    quizQuestion: "Qui est « Xangô » salué dans les toadas de Maracatu ?",
    quizOptions: ["L'Orixá de la foudre et de la justice", "Le premier danseur", "La flûte en bambou", "La marée montante"],
    quizCorrectIndex: 0,
  },
  {
    id: 'oxum', category: 'yoruba', br: 'Oxum',
    fr: 'Orixá des eaux douces, de la beauté et de la fertilité',
    phonetique: 'O-choun', conseilDiction: "Voyelle 'o' fermée, son 'ch', 'um' nasal comme 'oun'.", soundCardId: 'x_ch',
    quizQuestion: "Quelle divinité représente « Oxum » dans les chants ?",
    quizOptions: ["L'Orixá des eaux douces et de la beauté", "Le dieu du fer", "L'esprit de la forêt", "La reine mère"],
    quizCorrectIndex: 0,
  },
  {
    id: 'yemanja', category: 'yoruba', br: 'Iemanjá',
    fr: 'Reine de la mer et mère de tous les Orixás',
    phonetique: 'Ié-man-dja', conseilDiction: "Son 'j' prononcé 'dj' doux, 'an' nasal brésilien.", soundCardId: 'ao_am',
    quizQuestion: "Qui est « Iemanjá » célébrée sur les côtes du Nordeste ?",
    quizOptions: ["La Reine de la mer et des eaux salées", "La gardienne des tambours", "L'étoile du matin", "La lanceuse"],
    quizCorrectIndex: 0,
  },
  {
    id: 'ogum', category: 'yoruba', br: 'Ogum',
    fr: 'Orixá du fer, des forgerons et des chemins ouverts',
    phonetique: 'O-goun', conseilDiction: "Terminaison 'um' nasale 'oun', 'g' dur.", soundCardId: 'final_o_e',
    quizQuestion: "Que gouverne l'Orixá « Ogum » ?",
    quizOptions: ["Le fer, les outils et les chemins", "Les nuages et la pluie", "La parole sacrée", "Le miel et l'or"],
    quizCorrectIndex: 0,
  },
  {
    id: 'iansa', category: 'yoruba', br: 'Iansã',
    fr: 'Orixá des vents, des tempêtes et de la foudre',
    phonetique: 'I-an-ssan', conseilDiction: "Double nasale 'an' et 'ã' franchement projetée.", soundCardId: 'ao_am',
    quizQuestion: "De quoi « Iansã » est-elle la maîtresse ?",
    quizOptions: ["Des vents et des tempêtes", "Des profondeurs", "Des cours d'eau calmes", "Du silence"],
    quizCorrectIndex: 0,
  },
  {
    id: 'orixa', category: 'yoruba', br: 'Orixá',
    fr: 'Divinité et force de la nature dans le Candomblé et le Xangô',
    phonetique: 'O-ri-cha', conseilDiction: "R doux battu, X prononcé 'ch', 'á' final ouvert.", soundCardId: 'x_ch',
    quizQuestion: "Qu'est-ce qu'un « Orixá » dans la culture afro-brésilienne ?",
    quizOptions: ["Une divinité incarnant une force de la nature", "Un chant de deuil", "Un tambour aigu", "Une étape"],
    quizCorrectIndex: 0,
  },
  {
    id: 'nago', category: 'yoruba', br: 'Nagô',
    fr: 'Héritage culturel et linguistique Yoruba du Nordeste brésilien',
    phonetique: 'Na-gô', conseilDiction: "'ô' fermé et soutenu sans diphtongue.", soundCardId: 'open_closed_e_o',
    quizQuestion: "Que désigne le terme « Nagô » à Recife et Olinda ?",
    quizOptions: ["L'héritage yoruba et les Nations", "Une confrérie de marins", "Un tissu brodé", "Le chef de guerre"],
    quizCorrectIndex: 0,
  },
  {
    id: 'calunga', category: 'maracatu', br: 'Calunga',
    fr: 'Poupée sacrée en bois portée par la Dama do Paço, réceptacle des ancêtres',
    phonetique: 'Ca-loun-ga', conseilDiction: "Syllabe 'lun' nasalisée 'loun', articulation ferme.", soundCardId: 'final_o_e',
    quizQuestion: "Qu'est-ce que la « Calunga » dans une Nação de Maracatu ?",
    quizOptions: ["La poupée sacrée chargée de la force des ancêtres", "Le trône royal", "La cloche double", "La bannière"],
    quizCorrectIndex: 0,
  },
  {
    id: 'dama_do_paco', category: 'maracatu', br: 'Dama do Paço',
    fr: 'Dame du Palais portant la poupée sacrée Calunga en tête du cortège royal',
    phonetique: 'Da-ma dou Pa-ssou', conseilDiction: "'do' prononcé 'dou', 'ço' prononcé 'ssou'.", soundCardId: 'final_o_e',
    quizQuestion: "Quel est le rôle crucial de la « Dama do Paço » ?",
    quizOptions: ["Porter la Calunga sacrée devant le cortège royal", "Jouer du gonguê", "Donner le départ", "Couronner la reine"],
    quizCorrectIndex: 0,
  },
  {
    id: 'terreiro', category: 'maracatu', br: 'Terreiro',
    fr: 'Lieu de culte afro-brésilien où s’ancre la tradition spirituelle',
    phonetique: 'Tèr-hê-i-rou', conseilDiction: "Double 'rr' guttural, 'ei' diphtongué avec précision.", soundCardId: 'r_rr',
    quizQuestion: "Qu'est-ce qu'un « Terreiro » ?",
    quizOptions: ["L'espace sacré où s'enracine la tradition", "Une place de marché", "Un instrument", "Une fête profane"],
    quizCorrectIndex: 0,
  },
];
