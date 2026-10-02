# Preview artifact builder: runtime storage smoke

## Date

2026-10-01 UTC

## Contexte et défaut observé

Le dispatch `preview-artifact.yml` du merge `4266cf48219523fd915ace669f6f3c5e37b7e907` (run `36927518945`, job `110588406416`) a construit le standalone et passé les audits PDF.js et artefact. Son smoke a ensuite terminé sur `NPC_STORAGE_PREFLIGHT_FAILED`, suivi de `STANDALONE_HEALTH=FAIL`. Aucun artefact déployable n'a été publié.

`instrumentation.ts` appelle `assertNpcStorageReady({ capability: 'read-write' })` avant l'écoute réseau. Le workflow de livraison n'avait ni `NPC_STORAGE_ROOT` ni `DOCUMENT_STORAGE_ROOT`; la lane CI vidéo DISABLED préparait déjà ces deux racines. Le garde applicatif reste inchangé.

## Décision et limites

Le même script prépare désormais des racines jetables privées et distinctes sous `$RUNNER_TEMP` pour les deux workflows. La contre-épreuve démarre le **standalone construit** dans un processus séparé, avec uniquement `NPC_STORAGE_ROOT` retiré, et exige le marqueur de refus. Le smoke positif conserve ses prérequis jetables et vérifie santé, PID propriétaire du listener, identité de release, mode vidéo et en-têtes de sécurité avant toute archive. Le stockage jetable est hors du checkout et de l'archive ; seul le répertoire créé pour ce smoke est nettoyé.

Le builder conserve ses gardes source, GitGuardian, PDF.js, secrets, manifeste, SHA, BUILD_ID et digest. Aucune variable de Preview réelle ni donnée privée n'est copiée sur GitHub. Le run historique reste une preuve d'échec, non une réussite réinterprétée.

Après la première CI verte de PR, la revue a mis en évidence deux faux positifs possibles dans le harnais : une panne de la sonde `ss` pouvait passer inaperçue dans la contre-épreuve, et un répertoire de preuves préexistant sous forme de lien symbolique pouvait dévier les logs. Les deux cas sont désormais refusés explicitement, avec tests rouges puis verts. Le lancement négatif reste borné mais dispose de 60 secondes par défaut sur un runner froid (au lieu de 15), sans élargir le délai de santé du smoke positif.

## Vérifications

- Test RED : le contrat Jest a échoué parce que l'étape de préparation n'existait pas.
- Tests locaux avant durcissement de revue : six suites ciblées (gardes builder, préparation, contre-épreuve, lane vidéo et architecture stockage) — 53/53 PASS. Le test de santé a été vu rouge avant correction : `curl` doit se terminer avec succès **et** répondre HTTP 200. Après revue, les deux nouveaux contre-tests `ss` et lien symbolique ont échoué avant correction, puis les six suites ciblées ont passé 55/55 tests.
- `bash -n` des deux scripts : PASS. Les deux workflows se parsèrent ; leurs 190 blocs `run` passent `bash -n`.
- Lint ciblé des tests : PASS. Typecheck complet : PASS après génération locale des clients Prisma dans le worktree.
- Revue indépendante du diff final : aucun défaut bloquant relevé ; elle ne remplace pas la preuve runtime CI.
- La preuve fonctionnelle sur un standalone réellement construit doit venir de la lane CI de la PR, puis du nouveau dispatch post-merge. Aucun build lourd local n'est utilisé comme substitut.

## Risques restants et rollback

Avant CI de PR et revue humaine du head final, le correctif n'est pas livré. Si le nouveau smoke échoue, aucune archive n'est publiée. La Preview locale reste sur sa release précédente ; aucune migration ou reprise C2 v5 n'est engagée par cette PR.
