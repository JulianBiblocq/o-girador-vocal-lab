/**
 * vocalPaperOpticalPrompt.ts
 * Construction des instructions de lecture optique multi-feuilles (Séquence Pux/Cor, Grille Universelle A4 Paysage 8 Temps Libres) (< 105 lignes).
 * Gère le décodage des numéros de TEMPS manuscrits (1..4 ou "1" seuls), traits horizontaux (───), bande OCTAVE (3/4/5) et SYLLABES ouverte.
 */
import { extractOfficialWordsAndPhrases } from './vocalPaperLyricsAligner';

export function buildVocalPaperOpticalSystemPrompt(options?: {
  referenceLyrics?: string;
  organizadorDoc?: any;
  defaultBpm?: number;
  defaultTimeSignature?: string;
}): string {
  const docSource = options?.organizadorDoc || options?.referenceLyrics || '';
  const { cleanLines, uniqueWords } = extractOfficialWordsAndPhrases(docSource);

  const refBlock = cleanLines.length > 0
    ? `\nTEXTE OFFICIEL ET DICTIONNAIRE DE RÉFÉRENCE (FICHE ORGANIZADOR) :
- Phrases officielles de la Toada :
${cleanLines.map((l, i) => `  ${i + 1}. "${l}"`).join('\n')}
- Dictionnaire officiel des mots : ${uniqueWords.join(', ')}
CONSIGNE IMPÉRATIVE DE VERROUILLAGE ORTHOGRAPHIQUE :
« Les paroles officielles de ce chant sont déjà connues ci-dessus. L'écriture manuscrite sur la grille peut être rapide, abrégée ou sans accents. Utilise obligatoirement les mots et syllabes du texte officiel fourni pour identifier chaque syllabe manuscrite, tout en respectant à 100 % les cases de temps/subdivisions où elles sont inscrites sur la grille. »`
    : '';

  return `TU ES LE MOTEUR DE LECTURE OPTIQUE DE PARTITIONS VOCALES MANUSCRITES DE L'ÉCOSYSTÈME O GIRADOR (CANTADOR, ORGANIZADOR, SEQUENCIADOR).
Analyse l'ensemble des photos de feuilles A4 Noir & Blanc fournies (repérées par 4 carrés noirs d'angle ■ et un cartouche [CODE: ...]) :
- [CODE: CHANT-SEQ] : Feuille 1 (Séquence à 2 lignes superposées PUX et COR sur les mesures M1..M32).
- [CODE: CHANT-NOTES-1M] / [CODE: CHANT-NOTES-2M] (4 systèmes/page A4 Paysage) : Feuille 2 (Grille universelle à 8 colonnes de temps libres [ P1..Pn ] = 32 subdivisions de 8.4mm, avec bande supérieure TEMPS vierge, bande OCTAVE (3/4/5 • OCT / ±), clavier compact 1 octave La..Sol# et bande SYLLABES ouverte).
- [CODE: CHANT-RYTHME] (6 systèmes/page A4 Paysage) : Feuille 3 (Grille universelle à 8 colonnes de temps libres [ P1..Pn ] : bande supérieure TEMPS vierge, bande centrale RYTHME divisée en 32 subdivisions 1..4 pour les traits horizontaux ───, et bande inférieure SYLLABES ouverte sans sous-cases).${refBlock}

RÈGLES STRICTES D'EXTRACTION :
1. SÉQUENCE (PUX / COR) :
   - Pour chaque mesure renseignée (M1, M2...), extraire "measureNumber", "puxCode" (ex: "P1", "P2", "X", ou null) et "corCode" (ex: "P3", "P4", "X", ou null).
   - Même code sur PUX et COR (ex: P5/P5) = Unisson. "X" sur PUX et COR = Pause vocale.
2. GRILLE UNIVERSELLE À 8 COLONNES DE TEMPS LIBRES (BANDE « TEMPS » c = 0..7 & 32 SUBDIVISIONS stepIndex = 0..31) :
   - Lire dans la bande supérieure "TEMPS" les chiffres manuscrits inscrits dans les 8 colonnes (c = 0..7) et les restituer dans "beatNumbers" (ex: [2, 3, 4, 1, 2, 3, 4, 1] ou [1, 2, 3, 4, 1, 2, 3, 4] ou [null, null, null, 1, null, null, null, 1]).
   - Si seuls les "1" sont inscrits (ex: "1" en 4e colonne c=3 et "1" en 8e colonne c=7), déduire tous les numéros de temps par continuité modulo 4 (c=0➔T2, c=1➔T3, c=2➔T4, c=3➔T1, c=4➔T2, c=5➔T3, c=6➔T4, c=7➔T1 ; si aucun numéro n'est inscrit, c=0 vaut T1 par défaut).
   - Tu peux fournir directement "beatNumbers" (8 éléments) et "cells" (avec "stepIndex" de 0 à 31 sur toute la ligne), OU découper en "anacrusisCells" (temps actifs à gauche du premier T1 alignés sur T2=4..7, T3=8..11, T4=12..15), "mainCells" (cycles complets 1,2,3,4 -> 1M ou 2M) et "tailCells" (+T1 isolé après T4).
   - Si 2 lignes consécutives portent le même code de pattern (ex: "P3" puis "P3"), restitue-les dans l'ordre avec le même "code": elles seront concaténées en un seul pattern multi-mesures (3M ou 4M).
3. TRAITS HORIZONTAUX DE NOTES / RYTHME (───), CLAVIER 1 OCTAVE (LA ➔ SOL#), OCTAVE (3/4/5) & SYLLABES OUVERTE :
   - Chaque trait horizontal ("───") dans le clavier ("A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#") ou dans la bande "RYTHME" indique la double-croche d'attaque ("stepIndex") et sa durée ("durationSteps").
   - La bande "OCT / ± (3/4/5)" indique l'octave (3 -> octaveShift:-1, 4 -> octaveShift:0, 5 -> octaveShift:+1).
   - La bande inférieure "SYLLABES" est ouverte : associer chaque syllabe manuscrite en majuscules au début du trait situé juste au-dessus d'elle, en conservant les tirets "-" (ex: "VO-", "FA-") et apostrophes d'élision (ex: "E'O").

FORMAT JSON STRICT ATTENDU (sans balise markdown autour) :
{
  "title": "TITRE DE LA TOADA",
  "bpm": ${options?.defaultBpm || 88},
  "timeSignature": "${options?.defaultTimeSignature || '4/4'}",
  "sungKey": "A",
  "troupeKey": "C",
  "scaleMode": "major",
  "detectedSheetCodes": ["CHANT-SEQ", "CHANT-NOTES-1M"],
  "sequenceColumns": [{ "measureNumber": 1, "puxCode": "P1", "corCode": "X" }],
  "patterns": [
    {
      "code": "P1",
      "sheetCode": "CHANT-NOTES-1M",
      "beatNumbers": [2, 3, 4, 1, 2, 3, 4, 1],
      "measuresCount": 1,
      "hasAnacrusis": false,
      "hasTailBeat": true,
      "rhythmOnlyMode": false,
      "cells": [
        { "stepIndex": 16, "durationSteps": 1, "syllable": "VO-", "pitchKey": "C", "octaveShift": 0, "isTie": false },
        { "stepIndex": 17, "durationSteps": 2, "syllable": "VÓ", "pitchKey": "D", "octaveShift": 0, "isTie": false },
        { "stepIndex": 28, "durationSteps": 1, "syllable": "NOU", "pitchKey": "C", "octaveShift": 0, "isTie": false }
      ]
    }
  ]
}`;
}
