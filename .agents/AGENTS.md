# Directives d'Agent — Cantador (`o-girador-vocal-lab`)

## 0. RÈGLE STRICTE DE NOMMAGE DES APPLICATIONS O GIRADOR
Utiliser exclusivement l'orthographe brésilienne pure (zéro apostrophe, zéro accent parasite, zéro majuscule interne avant `-or`, zéro francisation `ch`, cédille obligatoire sur **Dançador**) :
- **O Girador** | **Orquestrador** | **Organizador** | **Sequenciador** | **Cantador** | **Dançador** | **Mostrador** | **Afinador** *(en conception, réservé sous `enabled: false` — aucun lien actif dans les menus utilisateurs)*

## 1. Validation Explicite Obligatoire
Lorsque tu présentes un plan d'implémentation (via `implementation_plan.md`), demande toujours une confirmation écrite explicite de l'utilisateur avant d'exécuter le plan, même si l'auto-approbation est active.

## 2. Frontend Performance & DOM Optimization Rules (4 Commandements Absolus)
1. **Zero Render Thrashing** : Interdiction de `useState` ou mutations de store pour les événements audio haute fréquence ou `requestAnimationFrame`. Utiliser exclusivement `useRef` et la mutation directe du DOM.
2. **Zero Layout Thrashing** : Mesurer la géométrie uniquement au montage ou via `ResizeObserver`, jamais dans la boucle RAF.
3. **Priorité GPU (WAAPI)** : Utiliser uniquement `element.animate()` ou `transform: translate3d(...)` et `opacity`.
4. **Zustand "ID-Only"** : Abonnement atomique par ID dans les listes.

---
### 🛡️ Gouvernance Centralisée des Règles Firebase & Sécurité (Strict)
- **Autorité unique :** Les règles `firestore.rules` et `storage.rules` sont exclusivement pilotées et déployées par **Orquestrador** (`o-girador-orquestrador`).
- **Interdiction formelle dans ce dépôt :** ne jamais créer, modifier ou déployer de règles Firebase locales (`npm run deploy` cible exclusivement `hosting:vocal-lab`).

---
## 3. Règles Architecturales Permanentes

### A. Plafond Strict `< 145 Lignes` (`src/`)
- **Seuil strict `< 145 lignes` réelles** (`content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length < 145`, soit 144 lignes max) sur l'ensemble des fichiers de `src/`. Toute logique dépassant ce seuil fait l'objet d'une extraction immédiate vers `src/components/...`, `src/hooks/...` ou `src/utils/...`.

### B. Découplage Graphique & Lexique Métier
- Utiliser exclusivement les variables CSS et jetons sémantiques Cordel (`var(--cordel-bg)`, `var(--cordel-text)`, `var(--cordel-border)`).
- Interdiction absolue du mot `Bateria` en contexte Maracatu (`Batuque` / `Baque`) et du mot `IA` dans l'interface utilisateur.
- Ne jamais écraser le champ `referencePitch: string` (`'C4'`) lors de l'usage du diapason acoustique `referencePitchHz?: number` (défaut `440`).

### C. Web Audio, Protection du Microphone & Interdiction de Playwright
- Tout nœud audio dynamique doit être déconnecté (`node.disconnect()`) au démontage, et tout flux micro (`MediaStream`) arrêté (`track.stop()`) au repos.
- **Aucun test E2E Playwright** dans ce dépôt. La validation technique repose sur `cmd /c "npx tsc --noEmit"` et `cmd /c "npm run build"`.

---
## RÈGLE STRICTE DES PORTS LOCAUX (ÉCOSYSTÈME O GIRADOR)
- **Orquestrador** : `5170` | **Sequenciador** : `5174` | **Organizador** / **Mostrador** : `5175` | **Dançador** : `5176` | **Cantador** : `5177` | **Afinador** *(réservé, inactif)* : `5178`
- Interdiction de modifier le port local sans instruction explicite (`strictPort: true` obligatoire).
