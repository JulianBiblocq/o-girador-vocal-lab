# Custom Rules — O Girador Vocal Lab

## Explicit Validation Request
L'utilisateur a demandé que les plans d'implémentation nécessitent toujours une validation explicite de sa part, même s'il a activé une politique de validation automatique (Auto-Approval) globale dans le système Antigravity.
Par conséquent :
- Lorsque tu présentes un plan d'implémentation (via l'artefact `implementation_plan.md`), NE TE CONTENTE PAS du feu vert automatique du système.
- Ajoute explicitement dans ta réponse textuelle : "Veuillez me confirmer par un message écrit que vous validez ce plan avant que je ne commence."
- Refuse d'exécuter le plan tant que l'utilisateur n'a pas répondu "ok", "vas-y", ou tout autre message confirmant son accord, MÊME SI l'événement "auto-approved" est déclenché.

## Frontend Performance & DOM Optimization Rules (4 Commandements Absolus)

**Rôle** : Ingénieur Staff Frontend, expert absolu en Performance Web, React 19, Zustand et Web Audio API. L'objectif est de concevoir des applications musicales temps-réel avec un framerate strict de 60 FPS sur tablette, sans jamais bloquer le Main Thread JavaScript ni désynchroniser l'horloge audio.

### Les 4 Commandements Absolus (Red Lines) :

1. **Zero Render Thrashing** : Interdiction d'utiliser `useState` ou des mutations de store pour des animations liées à des événements haute fréquence (ex : ticks audio ou `requestAnimationFrame`). Utiliser exclusivement des `useRef` et la mutation directe du DOM (Vanilla JS) en dehors du cycle React.
2. **Zero Layout Thrashing** : Traquer impitoyablement les lectures synchrones du DOM (`offsetHeight`, `getBoundingClientRect`, etc.) combinées à des mutations dans la même trame. Dans les visualiseurs (comme le balancier pendulaire), mesurer la géométrie uniquement au montage ou via `ResizeObserver`, jamais dans la boucle RAF.
3. **Priorité GPU (WAAPI)** : Bannir les transitions CSS modifiant la géométrie (`width`, `height`, top, left, etc.). Utiliser uniquement l'API native Web Animations ou `transform: translate3d(...)` et `opacity`.
4. **Zustand "ID-Only"** : Un composant parent affichant une liste ne doit récupérer QUE les IDs via `useShallow`. Il ne passe aucun callback de mutation en props. Chaque composant enfant récupère ses propres données et actions depuis le store via son ID.

Si du code est généré ou modifié, ces règles doivent être strictement respectées avec une brève justification de l'impact des choix sur le CPU (Reflow/Paint) et le Thread audio.

---
### 🛡️ Gouvernance Centralisée des Règles Firebase & Sécurité (Strict)
- **Autorité unique :** Les règles d'accès (`firestore.rules` et `storage.rules`) sont exclusivement pilotées, modifiées et déployées par le projet maître (**Orchestrador** / backend commun).
- **Interdiction formelle dans cette application :** 
  * Ne jamais créer, modifier ou valider de fichier local `firestore.rules` ou `storage.rules`.
  * Ne jamais exécuter de commande de déploiement de règles (`firebase deploy --only firestore:rules` ou `storage` formellement proscrits).
- **Développement client :** Les requêtes Firestore et Storage doivent impérativement s'adapter aux modèles de permissions et collections existants sans exiger d'altération des règles de sécurité depuis ce dépôt.

---
## Règles Architecturales Permanentes

### A. Règle Anti-Monolithe (Modularité & Extraction Immédiate)
- **Seuil strict (< 150 lignes)** : Tout composant React doit rester concis, modulaire et focalisé. Toute logique dépassant ce seuil ou 30 lignes de sous-traitance doit faire l'objet d'une extraction immédiate vers des sous-composants dédiés (`src/components/...`), des custom hooks (`src/hooks/...`) ou des modules utilitaires purs (`src/utils/...`).

### B. Découplage Graphique Multi-Univers (Design Tokens Sémantiques)
- **Bannir les styles en dur** : Interdiction formelle d'écrire des valeurs de couleur ou styles hardcodés dans les attributs `style={{ ... }}` ou les classes utilitaires statiques.
- **Usage des jetons sémantiques** : Utiliser exclusivement les variables CSS et jetons sémantiques Cordel (`var(--cordel-bg)`, `var(--cordel-text)`, `var(--cordel-border)`, `var(--cordel-wood)`, `themeTokens.css`, etc.) afin de garantir la cohérence graphique et le basculement instantané entre les thèmes.

### C. Commandements de Performance Web Audio & Temps-Réel
- **Zero Render Thrashing** : Proscription totale de `useState` et des mutations réactives pour les événements audio haute fréquence. Recourir exclusivement à des `useRef`, des écouteurs directs ou la manipulation DOM découplée.
- **Gestion du Graphe & Nettoyage des Nœuds Web Audio** : Tout nœud audio (`AudioNode`, `OscillatorNode`, `GainNode`, `MediaStreamAudioSourceNode`) créé dynamiquement doit être explicitement déconnecté et détruit (`node.disconnect()`) au démontage du composant ou à l'arrêt du cycle afin de garantir l'absence absolue de fuite mémoire.
- **Protection matérielle du microphone** : Aucun flux micro (`MediaStream`) ne doit rester ouvert au repos. Toute piste micro sollicitée pour une énumération ou pré-calibration doit être immédiatement coupée (`stream.getTracks().forEach(t => t.stop())`).

### D. Interdiction Formelle de Playwright
- **Aucun test E2E Playwright** : N'installer, ne créer et n'exécuter aucun test Playwright dans ce dépôt (source de régressions critiques sur le Web Audio).
- La validation technique repose exclusivement sur :
  1. `cmd /c "npx tsc --noEmit"` : 0 erreur TypeScript.
  2. `cmd /c "npm run build"` : compilation Vite de production réussie.
- **Tolérance zéro** : Aucune tâche ne peut être considérée comme terminée si l'une de ces deux commandes échoue.

---

## 7. Architecture Spécifique au Compagnon Vocal (O Girador Vocal Lab)
- **Architecture Batch Hors-Ligne** :
  1. **Capture sur bloc fixe calibré** : 1 mesure d'élan/anacrouse ($M-1$) + $N$ mesures de chant ($N \in \{1, 2, 3, 4\}$).
  2. **Nettoyage Trim & Nudge** : Découpage et calibration de latence hors-ligne.
  3. **Analyse de Pitch & Paroles** : Extraction des notes (Basic Pitch), syllabes et quantification selon les `beatResolutions` configurées par temps.
  4. **Export VocalPackExport v1.0** : Contrat standardisé pour réinjection fluide dans les pupitres vocaux (`puxador` et `coro`) de Sequenciador.

---

## RÈGLE STRICTE DES PORTS LOCAUX (ÉCOSYSTÈME O GIRADOR)
- Cet agent doit respecter la cartographie des ports :
  * Orchestrador : 5170
  * Sequenciador : 5174
  * Organizador : 5175
  * Dancador : 5176
  * **O Girador Vocal Lab : 5177**
- Interdiction de modifier le port local sans instruction explicite.
- `strictPort: true` est obligatoire : si le port est occupé, tuer les processus résiduels au lieu de changer de port.
