/**
 * vocalSheetInstructionsTemplate.ts
 * Feuille 4 : Guide & Conventions d'écriture Manuscrite A4 100 % Noir & Blanc ([CODE: CHANT-GUIDE]) (< 120 lignes).
 * Consultable directement dans l'onglet ou imprimable à la demande.
 */
import {
  renderFiducialCornersHTML,
  renderOpticalSheetCodeBadge,
} from './vocalPaperPrintHelper';

export function renderVocalSheetInstructionsHTML(): string {
  return `
    <div class="vocal-sheet-page">
      ${renderFiducialCornersHTML()}
      <div style="border-bottom:2.5px solid #000;padding-bottom:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13pt;font-weight:900;text-transform:uppercase;">
            FEUILLE 4 — GUIDE & CONVENTIONS D'ÉCRITURE MANUSCRITE DU CHANT
          </div>
          <div style="font-size:8pt;font-weight:700;">
            Mémo officiel O Girador (Cantador • Organizador • Sequenciador) — Impression 100 % Noir & Blanc
          </div>
        </div>
        ${renderOpticalSheetCodeBadge('CHANT-GUIDE')}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;flex:1;font-size:8.8pt;line-height:1.4;">
        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            1. SÉPARATION STRICTE PATTERNS NEUTRES (P1..Pn) / RÔLES (FEUILLE SÉQUENCE)
          </div>
          <div>
            • Sur les <b>Feuilles 2 et 3 (Patterns)</b>, chaque bloc porte uniquement un numéro neutre : <b>[ Pattern : P1 ]</b>, <b>[ Pattern : P2 ]</b>... sans mentionner Puxador ni Coro.<br/>
            • C'est sur la <b>Feuille 1 (Séquence)</b> que l'on inscrit qui chante quoi à chaque mesure sur les 2 lignes superposées :<br/>
            <span style="font-family:monospace;font-weight:900;display:inline-block;margin-top:3px;padding:2px 6px;border:1px solid #000;">
              Pux : P1 - P2 - X &nbsp;- X &nbsp;- P5<br/>
              Cor : X &nbsp;- X &nbsp;- P3 - P4 - P5
            </span><br/>
            • <b>Même code sur Pux et Cor (ex: P5 / P5)</b> = Chant simultané à l'Unisson (Tutti).<br/>
            • <b>Deux codes différents (ex: P5 sur Pux et P6 sur Cor)</b> = Chant simultané à 2 voix.<br/>
            • <b>X sur Pux ET X sur Cor</b> = Mesure de Pause vocale (<b>[PAUSE 1M]</b>, le Batuque joue seul).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            2. ÉCRITURE DES SYLLABES, MOTS, ÉLISIONS & TENUES (SOUS-CASES 1..4)
          </div>
          <div>
            • <b>Majuscules bâtons :</b> Écrire chaque syllabe en lettres capitales bien détachées (ex: <b>VO-</b> | <b>VÓ</b> | <b>FA-</b> | <b>LOU</b>).<br/>
            • <b>Tiret "-" en fin de case :</b> Indique que la syllabe se soude à la suivante pour former un même mot (ex: <b>CA-</b> + <b>I-</b> + <b>XA</b> ➔ <i>caixa</i>).<br/>
            • <b>Absence de tiret :</b> Indique la fin du mot (un espace sera inséré avant la syllabe suivante).<br/>
            • <b>Élision sur une même double-croche :</b> Unir par une apostrophe dans la même case (ex: <b>E'O</b> dans <i>falou e'o barão</i>, ou <b>D'Á-</b> | <b>GUA</b>).<br/>
            • <b>Tenue de note / syllabe prolongée :</b> Tracer une flèche horizontale <b>───►</b> dans les cases suivantes tant que la voix tient la note.<br/>
            • <b>Silence explicite :</b> Laisser la case vide ou inscrire <b>_</b>. Pour un triolet sur un temps, coiffer les 3 cases par <b>┌ 3 ┐</b>.
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            3. CLAVIER 1 OCTAVE (LA ➔ SOL#) & LIGNE D'OCTAVE (OCT / ±)
          </div>
          <div>
            • Le clavier vertical comporte <b>12 lignes (de La à Sol#)</b> : les touches noires (<b>Si♭, Do#, Mi♭, Fa#, Sol#</b>) sont hachurées en N&B.<br/>
            • Les lignes <b>La (1re ligne)</b> et <b>Do (4e ligne)</b> ont un filet horizontal renforcé pour repérer immédiatement sa tonique.<br/>
            • <b>Ligne OCT / ± :</b> Si une note franchit le Sol# vers le haut, inscrire <b>+1</b> dans la ligne <i>OCT / ±</i> au-dessus de la colonne ; si elle descend sous le La, inscrire <b>-1</b>.
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            4. PRISE DE PHOTO & IMPORT MULTI-PAGES
          </div>
          <div>
            • Garder les <b>4 carrés noirs d'angle (■)</b> bien visibles dans le cadre de chaque photo.<br/>
            • Prendre chaque feuille en photo une par une (ex: 1 photo de la Feuille Séquence + 2 photos de Feuilles Patterns) et les ajouter ensemble dans la fenêtre d'import.
          </div>
        </div>
      </div>
    </div>
  `;
}
