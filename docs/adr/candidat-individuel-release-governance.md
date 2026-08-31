# Gouvernance de release immuable — candidat individuel

## Statut

Décision versionnée avant le gel final. Aucun artefact, tag ou attestation finale n'est créé par ce changement.

## Invariants

- `FINAL_SOURCE_SHA` est une SHA Git lowercase de 40 caractères, égale à `HEAD` dans un worktree propre.
- Aucun commit, y compris documentaire, n'est autorisé après le gate source final.
- Le build de production est exécuté exactement une fois avec `NEXUS_RELEASE_SOURCE_SHA=$FINAL_SOURCE_SHA`.
- Le manifeste embarqué exclut uniquement `release-qualification-manifest.json` de son inventaire. Les sidecars restent hors du payload.
- L'inventaire canonique couvre fichiers, répertoires vides, modes et symlinks relatifs. Tout ajout, retrait, changement de contenu, mode ou cible invalide la release.
- Les migrations sont exactement `88 -> 88`, avec `0` migration appliquée.
- L'archive finale est créée après insertion du manifeste. Son SHA-256 n'est écrit que dans l'attestation et son sidecar externes.
- L'artefact n'est jamais reconstruit après qualification.

## Procédure de qualification

1. Depuis le commit final propre, exporter `FINAL_SOURCE_SHA=$(git rev-parse HEAD)` et vérifier que la branche distante contient exactement ce commit.
2. Exécuter `npm ci`, puis une seule fois `NEXUS_RELEASE_SOURCE_SHA=$FINAL_SOURCE_SHA npm run build`. Enregistrer `BUILD_ID`, Node, npm, Next et Prisma.
3. Produire l'entrée de build minimale `nexus-release-build-input/v1`, puis générer le manifeste via `npm run release:qualification:manifest -- ...`. Le payload est `.next/standalone`; son `.next/BUILD_ID` doit correspondre. Le manifeste ne pré-déclare aucun résultat E2E futur.
4. Créer une archive tar déterministe après insertion du manifeste. Ne plus modifier ni reconstruire le payload ou l'archive.
5. Exécuter les gates source, DB, sécurité et les deux lanes navigateur sur cette archive inchangée. Produire l'entrée finale `nexus-release-qualification-input/v1` avec chaque commande, son statut et ses comptes exacts.
6. Pousser sans force la branche `release/candidat-individuel-prod`, puis le tag annoté `candidat-individuel-v1-<12 premiers caractères SHA>`.
7. Configurer la protection de branche avec force-push désactivé. Le check distant recommandé est l'agrégat `CI Success`, qui inclut `Hermetic DB Order Matrix`.
8. Exécuter `release:governance:verify` contre le remote réel. Le script interroge `git ls-remote` et l'API GitHub; une preuve locale manuscrite ne remplace pas ces contrôles.
9. Générer l'attestation externe, qui seule porte les résultats de qualification, puis exécuter `release:qualification:verify` immédiatement avant tout cutover.

## Protection et interdictions

- Ne jamais utiliser `git push --force`, `--force-with-lease`, un tag léger ou un tag déplacé.
- La branche distante, le tag annoté pelé, le check CI et l'attestation doivent tous viser la même SHA.
- La vérification échoue si GitHub ne confirme pas explicitement `allow_force_pushes.enabled=false`.
- Une absence de permission/API, un check absent ou un état autre que `success` bloque le cutover.
- Tout changement source après le gate impose une nouvelle SHA, un nouveau build et une qualification complète.

## Rollback

Ces outils ne mutent ni production ni base de données. Le rollback de leur adoption consiste uniquement à ne pas qualifier l'artefact. Une release déjà disqualifiée ne doit jamais être réutilisée.
