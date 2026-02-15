# Architecture Module `maths-1ere`

## 1) Hydratation (cache local + Supabase)

- Route `app/programme/maths-1ere/page.tsx` protège l'accès (session requise, sauf bypass test).
- Le client `app/programme/maths-1ere/components/MathsRevisionClient.tsx` démarre avec un splash et tente une hydratation distante via `loadProgressWithStatus()`.
- Le store Zustand (`app/programme/maths-1ere/store.ts`) persiste localement (`localStorage`) pour la continuité UX, mais l'état distant est la source d'autorité dès que chargé.
- Si l'hydratation distante échoue/timeout: `hydrationError` est positionné, UI explicite "Session non disponible", et aucune écriture distante n'est autorisée.

## 2) Sync Store -> DB (garanties anti-écrasement)

- Flags de sécurité du store:
  - `isHydrated`: vrai uniquement après hydratation confirmée.
  - `canWriteRemote`: vrai uniquement si l'écriture distante est autorisée.
  - `hydrationError`: bloque la sync si non null.
- Le flux de sync est gardé: aucune requête d'upsert n'est envoyée tant que `isHydrated !== true` ou `canWriteRemote !== true`.
- Invariant de sécurité: un timeout d'hydratation ne peut pas déclencher un upsert "vide", car `canWriteRemote` reste `false`.
- Écriture distante:
  - chemin principal: `POST /api/programme/maths-1ere/progress` (authentifié, serveur, `SUPABASE_SERVICE_ROLE_KEY`).
  - fallback client direct Supabase (si nécessaire) pour robustesse.
- Résilience perte réseau/fermeture onglet:
  - file d'attente en mémoire `pendingPayloadRef`.
  - retry au retour réseau (`online`).
  - flush critique via `navigator.sendBeacon()` puis fallback `fetch(..., { keepalive: true })` sur `beforeunload/pagehide/visibilitychange`.
- Sécurité API:
  - middleware exige un token pour `/api/programme/maths-1ere/progress`.

## Runbook incident (résumé)

- Symptôme: bannière "Mode hors ligne" ou "Échec de sauvegarde".
- Action: vérifier connectivité réseau, statut Supabase, et variables `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY`.
- Comportement attendu: l'UI continue sans crash, les écritures distantes reprennent automatiquement au retour `online`.

## 3) MathJax et prévention du FOUC

- `MathJaxProvider` gère le chargement script et expose `typesetPromise`.
- Les vues qui affichent des formules déclenchent un re-typeset contrôlé (`useMathJax`) lors des changements de chapitre/onglet.
- Le splash d'hydratation évite le rendu incomplet pendant l'initialisation, réduisant les flashes visuels de contenu mathématique brut.
- Les tests E2E vérifient explicitement:
  - absence de LaTeX brut visible,
  - présence de nœuds MathJax rendus.

## Chargement différé & poids bundle

- Les composants lourds sont chargés en lazy (`next/dynamic`, `ssr:false`) dans `MathsRevisionClient`:
  - `PythonIDE` (Pyodide)
  - `InteractiveMafs`
  - `MathInput`
  - Labs interactifs (`ParabolaController`, `TangenteGlissante`, `MonteCarloSim`, etc.)
- Résultat build observé:
  - `/programme/maths-1ere` est dynamique (`ƒ`) avec `351 kB` de route et `503 kB` First Load JS.
  - La séparation dynamique limite le coût initial hors parcours laboratoire avancé.
