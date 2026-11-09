/**
 * vocalSheetInstructionsTemplate.ts
 * Feuille 4 : Guide & Conventions d'écriture Manuscrite A4 100 % Noir & Blanc ([CODE: CHANT-GUIDE]) (< 95 lignes).
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
            • Sur les <b>Feuilles 2 et 3 (Patterns)</b>, chaque bloc porte uniquement un en-tête compact : <b>[ PATTERN : P1 ]</b>, <b>[ PATTERN : P2 ]</b>... sans case à cocher.<br/>
            • L'<b>Anacrouse (Ana T3-T4)</b> et la <b>Chute (+T1)</b> sont détectées <b>100 % automatiquement</b> dès qu'un trait de note ou une syllabe y figure.<br/>
            • C'est sur la <b>Feuille 1 (Séquence)</b> que l'on inscrit qui chante quoi à chaque mesure sur les 2 lignes superposées :<br/>
            <span style="font-family:monospace;font-weight:900;display:inline-block;margin-top:3px;padding:2px 6px;border:1px solid #000;">
              Pux : P1 - P2 - X &nbsp;- X &nbsp;- P5<br/>
              Cor : X &nbsp;- X &nbsp;- P3 - P4 - P5
            </span><br/>
            • <b>Même code sur Pux et Cor (ex: P5 / P5)</b> = Chant simultané à l'Unisson (Tutti) • <b>X / X</b> = Mesure de Pause vocale (<b>[PAUSE 1M]</b>).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            2. TRAITS HORIZONTAUX DE NOTES (───) & BANDE « SYLLABES » OUVERTE (SANS SOUS-CASES)
          </div>
          <div>
            • <b>Trait horizontal (───) :</b> Tracer un trait horizontal dans la ligne de la note (ou dans la piste <i>RYTHME / DURÉE</i> sur la Feuille 3) en partant de la double-croche d'attaque (1, 2, 3 ou 4) jusqu'à la fin de sa durée.<br/>
            • <b>Bande SYLLABES ouverte (9.5mm) :</b> Sans cloisons de doubles-croches pour écrire confortablement en <b>MAJUSCULES BÂTONS</b> juste sous le début de chaque trait de note.<br/>
            • <b>Tiret "-" :</b> Soude les syllabes d'un même mot (ex: <b>VO-</b> &nbsp; <b>VÓ</b> &nbsp; <b>FA-</b> &nbsp; <b>LOU</b>) • <b>Apostrophe :</b> Élision sur une même attaque (ex: <b>E'O</b>, <b>D'Á-</b>).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            3. CLAVIER COMPACT 1 OCTAVE (LA ➔ SOL#) & BANDE « OCTAVE (3 / 4 / 5) »
          </div>
          <div>
            • Le clavier vertical comporte <b>12 lignes compactes (de La à Sol#, 2.2mm/ligne)</b> : touches noires (<b>Si♭, Do#, Mi♭, Fa#, Sol#</b>) hachurées en N&B, filets renforcés sur <b>La</b> et <b>Do</b>.<br/>
            • <b>Bande OCTAVE (OCT / ± • 3/4/5) :</b> Bande ouverte de 6mm au-dessus du clavier pour inscrire lisiblement l'octave (<b>3</b>, <b>4</b>, <b>5</b> ou <b>+1</b> / <b>-1</b>).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.5pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            4. PRISE DE PHOTO & IMPORT MULTI-PAGES
          </div>
          <div>
            • Garder les <b>4 carrés noirs d'angle (■)</b> bien visibles dans le cadre de chaque photo (5 blocs/page en Portrait 1M, 4 blocs/page en Paysage 2M).
          </div>
        </div>
      </div>
    </div>
  `;
}
