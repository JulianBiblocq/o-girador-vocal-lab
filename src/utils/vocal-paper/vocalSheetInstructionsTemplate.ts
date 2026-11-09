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
      <div style="border-bottom:2.5px solid #000;padding-bottom:4px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
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

      <div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2.5mm;flex:1;font-size:8.6pt;line-height:1.38;">
        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.3pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            1. GRILLE UNIVERSELLE A4 PAYSAGE À « 8 TEMPS LIBRES (32 SUBDIVISIONS DE 8.4MM) »
          </div>
          <div>
            • Les <b>Feuilles 2 (Patterns & Notes — 4 systèmes/page)</b> et <b>3 (Paroles & Rythme — 6 systèmes/page)</b> offrent <b>8 colonnes de temps vierges</b> par ligne, sans intitulés pré-imprimés.<br/>
            • Dans la bande supérieure <b>TEMPS (4.5mm)</b>, inscrivez vous-même les numéros de temps (ou uniquement les <b>1</b> aux débuts de mesures) :<br/>
            &nbsp;&nbsp;— <b>2 | 3 | 4 | 1 | 2 | 3 | 4 | 1</b> : jusqu'à <b>3 temps d'anacrouse</b> (T2-T3-T4) + <b>1 mesure complète</b> (T1..T4) + <b>1 temps de chute (+T1)</b>.<br/>
            &nbsp;&nbsp;— <b>1 | 2 | 3 | 4 | 1 | 2 | 3 | 4</b> : <b>2 mesures complètes</b> (2M) sur une seule ligne.<br/>
            • <b>Patterns de 3 ou 4 mesures :</b> Inscrivez le même code (ex. <b>P3</b>) sur 2 lignes consécutives : elles seront automatiquement fusionnées à la suite !
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.3pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            2. TRAITS HORIZONTAUX DE NOTES / RYTHME (───) & BANDE « SYLLABES » OUVERTE
          </div>
          <div>
            • <b>Trait horizontal (───) :</b> Tracer un trait continu dans la ligne de la note (Feuille 2) ou dans la bande <i>RYTHME</i> de 5.5mm (Feuille 3) de la double-croche d'attaque (1..4) jusqu'à la fin de sa durée.<br/>
            • <b>Bande SYLLABES ouverte (9.5mm / 11mm) :</b> Sans sous-cases de doubles-croches pour écrire en <b>MAJUSCULES BÂTONS</b> juste sous le début de chaque trait.<br/>
            • <b>Tiret "-" :</b> Soude les syllabes d'un même mot (ex: <b>VO-</b> &nbsp; <b>VÓ</b> &nbsp; <b>FA-</b> &nbsp; <b>LOU</b>) • <b>Apostrophe :</b> Élision sur une même attaque (ex: <b>E'O</b>, <b>D'Á-</b>).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.3pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            3. CLAVIER COMPACT 1 OCTAVE (LA ➔ SOL#) & SÉQUENCE PUX / COR (FEUILLE 1)
          </div>
          <div>
            • <b>Clavier 1 octave (12 lignes × 2.2mm, de La à Sol#) :</b> touches noires hachurées N&B, filets renforcés sur <b>La</b> et <b>Do</b>, bande <b>OCT / ± (3/4/5)</b> de 5.5mm au-dessus.<br/>
            • Sur la <b>Feuille 1 (Séquence M1..M32)</b>, répartissez les codes <b>P1..Pn</b> sur les 2 lignes <b>Pux</b> et <b>Cor</b> (même code <b>P5/P5</b> = Unisson • <b>X/X</b> = Pause vocale).
          </div>
        </div>

        <div style="border:2px solid #000;padding:6px 8px;">
          <div style="font-size:9.3pt;font-weight:900;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin-bottom:4px;">
            4. PRISE DE PHOTO & IMPORT MULTI-PAGES
          </div>
          <div>
            • Garder les <b>4 carrés noirs d'angle (■)</b> bien visibles dans le cadre de chaque photo (Feuille 1 Portrait, Feuille 2 Paysage 4 systèmes, Feuille 3 Paysage 6 systèmes).
          </div>
        </div>
      </div>
    </div>
  `;
}
