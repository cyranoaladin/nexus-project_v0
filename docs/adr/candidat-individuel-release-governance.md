# Gouvernance de release immuable — candidat individuel

## Statut

Décision versionnée avant le gel final. Aucun artefact, tag ou attestation finale n'est créé par ce changement.

## Invariants

- `FINAL_SOURCE_SHA` est une SHA Git lowercase de 40 caractères, égale à `HEAD` dans un worktree propre.
- Aucun commit, y compris documentaire, n'est autorisé après le gate source final.
- Le build de production est exécuté exactement une fois avec `NEXUS_RELEASE_SOURCE_SHA=$FINAL_SOURCE_SHA`.
- Le build unique est lancé par `release:qualification:build`; ce processus dérive le `BUILD_ID`, vérifie les empreintes serveur et client, copie uniquement son propre `.next/standalone` vers le staging gouverné et y écrit `release-build-provenance.json`. Un payload ou une preuve reconstruits sont refusés.
- Le manifeste embarqué exclut uniquement `release-qualification-manifest.json` de son inventaire. Les sidecars restent hors du payload.
- L'inventaire canonique couvre fichiers, répertoires vides, modes et symlinks relatifs. Tout ajout, retrait, changement de contenu, mode ou cible invalide la release.
- Les migrations sont exactement `88 -> 88`, avec `0` migration appliquée.
- L'archive finale est créée après insertion du manifeste. Son SHA-256 n'est écrit que dans l'attestation et son sidecar externes.
- L'archive est produite par le packager canonique GNU tar (ordre lexical, epoch fixe, uid/gid/modes et PAX normalisés). Deux empaquetages indépendants du même payload doivent être identiques octet pour octet.
- L'artefact n'est jamais reconstruit après qualification.

## Modèle de menace et frontières de confiance

- Racines de confiance : le worktree Git propre à la SHA finale, le build Next unique lancé par l'orchestrateur, le remote Git canonique configuré et les réponses authentifiées de l'API GitHub obtenues via `gh`.
- Payload forgé : pendant la création, l'orchestrateur contrôle les realpaths du vrai `.next/standalone` et du staging, puis émet un reçu sans chemin absolu contenant uniquement les identités logiques canoniques et les digests du standalone, du payload, de la provenance embarquée et de l'entrée de build. Les vérifications portables aval recomputent ces digests; un transfert octet-identique reste valide, une reconstruction ou modification ne l'est pas.
- Remote forgé : l'identité `owner/repository` est dérivée uniquement d'une URL GitHub canonique sans identifiant, query ou fragment. Elle est persistée dans la preuve et l'attestation; aucun argument `repository` libre n'est accepté.
- CI homonyme ou périmée : les pages complètes de workflow-runs et check-runs sont interrogées. Le run terminé le plus récent de `.github/workflows/ci.yml` à la SHA exacte doit être réussi; pour chaque nom obligatoire, le check le plus récent rattaché à ce run doit également être réussi et appartenir à l'application GitHub Actions officielle. Un succès ancien ne masque jamais un échec récent.
- Gouvernance périmée : la branche, le tag annoté, les checks, la protection administrateurs/no-force/no-delete et le ruleset tag actif sans bypass sont réinterrogés lors de l'attestation et immédiatement lors de la vérification finale. Un JSON local seul ne suffit jamais.
- Archive hostile/TOCTOU : le vérificateur ouvre sans suivre de symlink, crée une copie temporaire privée immuable, audite ses en-têtes avant extraction puis extrait et hache cette même copie. Le packager travaille dans un répertoire privé sur le filesystem de destination et publie par hard-link exclusif, sans remplacement ni `EXDEV`. Traversées, chemins absolus, liens dangereux, types spéciaux, doublons, métadonnées/PAX non canoniques et limites de taille ou de membres sont fail-closed.
- Limites : ces outils exigent GNU tar, Git, `gh` authentifié et les permissions de lecture de gouvernance GitHub. Une indisponibilité ou une réponse non prouvée bloque la qualification; elle n'est jamais interprétée comme un succès.

## Procédure de qualification

1. Depuis le commit final propre, exporter `FINAL_SOURCE_SHA=$(git rev-parse HEAD)` et vérifier que la branche distante contient exactement ce commit.
2. Exécuter `npm ci`, préparer les métadonnées bornées puis lancer `npm run release:qualification:build -- ...` avec `FINAL_SOURCE_SHA` et `NEXUS_RELEASE_SOURCE_SHA` identiques. Ne jamais lancer `npm run build` séparément pour cet artefact.
3. Générer le manifeste via `npm run release:qualification:manifest -- ...` en fournissant le reçu de build et l'entrée de build produits par l'orchestrateur. Le manifeste ne pré-déclare aucun résultat E2E futur.
4. Créer l'archive déterministe avec `npm run release:qualification:package -- ...` après insertion du manifeste. Ne plus modifier ni reconstruire le payload ou l'archive.
5. Exécuter les gates source, DB, sécurité et les deux lanes navigateur sur cette archive inchangée. Produire l'entrée finale `nexus-release-qualification-input/v1` avec chaque commande, son statut et ses comptes exacts.
6. Pousser sans force la branche `release/candidat-individuel-prod`, puis le tag annoté `candidat-individuel-v1-<12 premiers caractères SHA>`.
7. Configurer la protection de branche avec administrateurs inclus, force-push et suppression désactivés, ainsi qu'un ruleset tag actif sans bypass couvrant exactement `refs/tags/candidat-individuel-v1-*`. Les deux checks obligatoires sont `CI Success` et `Hermetic DB Order Matrix`.
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
