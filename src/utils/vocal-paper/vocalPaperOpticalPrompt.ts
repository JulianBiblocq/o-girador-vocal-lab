/**
 * vocalPaperOpticalPrompt.ts
 * Construction des instructions de lecture optique multi-feuilles (Séquence Pux/Cor, Patterns & Notes, Rythme seul) (< 105 lignes).
 * Gère les traits horizontaux de notes (───), la bande OCTAVE (3/4/5 ou ±1), la bande SYLLABES ouverte et l'auto-détection Ana T3-T4 / +T1.
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
- [CODE: CHANT-NOTES-1M] (5 blocs/page Portrait) ou [CODE: CHANT-NOTES-2M] (4 blocs/page Paysage) : Feuille 2 (Patterns neutres [ PATTERN : P1..Pn ] avec clavier compact 1 octave La..Sol#, bande OCTAVE (3/4/5 • OCT / ±), Ana T3-T4, Temps 1..4, +T1 et bande SYLLABES ouverte).
- [CODE: CHANT-RYTHME] (7 lignes/page A4 Paysage, cartouche vertical P1..Pn de 13mm à gauche) : Feuille 3 (Patterns neutres P1..Pn en 2 bandes superposées : bande supérieure RYTHME de 5.5mm divisée en 4 subdivisions 1..4 par temps où chaque trait horizontal continu tracé au crayon indique la subdivision exacte d'attaque et sa durée en doubles-croches, et bande inférieure SYLLABES ouverte de 11mm sans sous-cases où chaque syllabe manuscrite est associée au trait de rythme situé juste au-dessus d'elle).${refBlock}

RÈGLES STRICTES D'EXTRACTION :
1. SÉQUENCE (PUX / COR) :
   - Pour chaque mesure renseignée (M1, M2...), extraire "measureNumber", "puxCode" (ex: "P1", "P2", "X", ou null) et "corCode" (ex: "P3", "P4", "X", ou null).
   - Même code sur PUX et COR (ex: P5/P5) = Unisson. "X" sur PUX et COR = Pause vocale.
2. PATTERNS NEUTRES (P1, P2...) & DÉTECTION AUTOMATIQUE ANACROUSE / CHUTE (+T1) :
   - Il n'y a aucune case à cocher pour l'anacrouse ni la chute : détecte-les 100 % automatiquement !
   - Si les colonnes Ana T3 ou Ana T4 contiennent au moins un trait de note/rythme ou une syllabe, "hasAnacrusis": true et remplis "anacrusisCells" (sinon "hasAnacrusis": false, "anacrusisCells": []).
   - Si la colonne +T1 contient un trait de note/rythme, une prolongation de tenue ("───") ou une syllabe, "hasTailBeat": true et remplis "tailCells" (sinon "hasTailBeat": false, "tailCells": []).
   - "rhythmOnlyMode": true si la feuille est [CODE: CHANT-RYTHME] ou si aucun trait n'est présent dans le clavier La..Sol#.
3. TRAITS HORIZONTAUX DE NOTES / RYTHME (───), CLAVIER 1 OCTAVE (LA ➔ SOL#) & BANDE OCTAVE (3 / 4 / 5) :
   - Sur CHANT-NOTES-1M/2M, les notes sont tracées sous forme de traits horizontaux ("───") dans les 12 lignes du clavier ("A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#").
   - Sur CHANT-RYTHME, dans la bande supérieure "RYTHME" (divisée en 4 subdivisions par temps), chaque trait horizontal continu tracé au crayon indique la subdivision exacte d'attaque ("stepIndex", active: true, isTie: false) et sa durée en doubles-croches ("durationSteps", ou subdivisions suivantes traversées par le trait en "isTie": true, "syllable": "───").
   - La bande ouverte "OCT / ± (3/4/5)" au-dessus du clavier contient le numéro d'octave (3 -> octaveShift:-1, 4 -> octaveShift:0, 5 -> octaveShift:+1, ou directement -1, 0, +1).
4. BANDE « SYLLABES » OUVERTE (SANS SOUS-CASES), TIRETS & ÉLISIONS :
   - La bande inférieure "SYLLABES" est ouverte (sans cloisons de doubles-croches) : chaque syllabe manuscrite écrite en majuscules est associée à l'attaque ("stepIndex") du trait de note ou de rythme situé juste au-dessus d'elle.
   - Conserver le tiret final "-" lorsqu'il soude les syllabes d'un même mot (ex: "VO-", "FA-") et les élisions avec apostrophe (ex: "E'O", "D'Á-", "XE'O").

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
      "measuresCount": 1,
      "hasAnacrusis": false,
      "hasTailBeat": true,
      "rhythmOnlyMode": false,
      "anacrusisCells": [],
      "mainCells": [
        { "stepIndex": 4, "durationSteps": 1, "syllable": "VO-", "pitchKey": "C", "octaveShift": 0, "isTie": false },
        { "stepIndex": 5, "durationSteps": 2, "syllable": "VÓ", "pitchKey": "D", "octaveShift": 0, "isTie": false }
      ],
      "tailCells": [{ "stepIndex": 0, "durationSteps": 1, "syllable": "NOU", "pitchKey": "C", "octaveShift": 0, "isTie": false }]
    }
  ]
}`;
}
