# Validation finale — durcissement du stockage NPC

## Date

11 août 2026

## Contexte

La branche `agent/npc-storage-hardening` unifie la racine de stockage NPC persistante, durcit les gardes de démarrage et de chemins, protège l'intégrité des copies et des issues terminales, masque les rapports internes aux familles, impose le type documentaire et fournit une commande de tombstone auditée.

La validation a été menée sans accès ni mutation de production, avec `NPC_LLM_MODE=off`. Les bases, volumes, exports, comptes et documents utilisés par les tests étaient synthétiques et jetables.

## Problèmes observés

- L'issue d'échec générique du worker validait initialement le job `FAILED` avant de tenter, dans une seconde transaction, la transition de la soumission vers `ANALYSIS_FAILED`. Une panne intermédiaire pouvait laisser les deux entités incohérentes.
- Le fallback de compatibilité vers `inputData.submissionId` devait refuser de muter une soumission déjà rattachée à un autre job, et tolérer un ancien `inputData` malformé en terminalisant uniquement le job.
- Le build lancé depuis un worktree est, à juste titre, refusé par l'audit des traces de release. Le même build complet depuis un clone temporaire isolé est valide.
- Le premier passage CI sur runner propre a révélé cinq écarts de câblage ou de portabilité : racine NPC non préparée pour les deux démarrages standalone, suite tombstone root-only lancée dans la lane générique, UID de test supposé fixe et longueur de tag AES-GCM non explicite. `CI Success` ne faisait qu'agréger ces échecs.

## Décisions prises

- Écrire l'échec terminal du job et l'état de la soumission dans une transaction unique, avec un ordre de verrouillage global soumission puis job.
- Considérer `copySubmissionId` comme liaison autoritative. Le fallback historique ne peut muter la soumission que si `CopySubmission.aiJobId` désigne encore exactement le job traité ; une valeur historique malformée devient un cas job-only sans exception.
- Conserver la migration strictement additive : ajout de valeurs d'enum, colonnes et contrainte seulement. Aucun `UPDATE`, aucune suppression et aucun identifiant métier en dur.
- Publier la commande de tombstone sans l'exécuter en production. Son utilisation réelle requiert un feu vert distinct après merge et déploiement.
- Préparer une racine NPC privée hors checkout dans chaque job CI qui démarre l'application, sans repli applicatif.
- Maintenir les trois suites NPC réelles dans le check Integration, via leur harness root-only jetable et avec le LLM désactivé.
- Fixer explicitement le tag AES-GCM à 16 octets pour le chiffrement comme pour le déchiffrement.

## Conformité vérifiée

- **Migration additive** : `20260811140000_add_npc_unavailable_integrity` ne contient que `ALTER TYPE ... ADD VALUE`, `ADD COLUMN` et `ADD CONSTRAINT`; aucun `UPDATE` ni identifiant de soumission.
- **Tombstone paramétré et fail-closed** : le CLI exige exactement `--submission-id <opaque>` et la concordance avec le manifeste. Le manifeste fixe une soumission, quatre pages, le rapport, son statut et sa visibilité, le job et l'acteur attendus.
- **Export avant mutation** : enveloppe JSON intégralement chiffrée et authentifiée, créée avec `O_EXCL | O_NOFOLLOW`, mode `0600`, synchronisée et relue avant la validation métier et la transaction.
- **Périmètre exact** : refus des comptes de pages 3 ou 5, des rapports/statuts/visibilités/jobs divergents, des chemins permissifs, symboliques ou situés dans le dépôt/release. La mutation conditionnelle porte sur une soumission et exactement quatre pages.
- **Transaction, audit et idempotence** : verrouillage et mutation atomiques, audit déterministe `CopySubmission` avec acteur et rapport exacts, post-vérification des compteurs, seconde exécution `already-applied`, refus des états partiels ou altérés.
- **Visibilité familles** : `COACH_ONLY` et `UNAVAILABLE` sont exclus des listes parent et élève. La projection serveur ne conserve que `studentSummary` pour `STUDENT_SUMMARY_ONLY`; les compteurs sont calculés après projection.
- **Démarrage fail-closed** : application et worker refusent de démarrer sans `NPC_STORAGE_ROOT` explicite, persistant et valide. Les traversées et symlinks sont refusés.
- **Intégrité de finalisation** : une soumission ne peut devenir `COMPLETED` si une source manque, si sa taille ou son SHA-256 diverge, ou si le miroir de copie élève n'est pas intact.
- **Type documentaire explicite** : les API et l'interface n'inventent aucun type par défaut; toutes les créations runtime de pages passent par le writer typé.
- **Invariants hors périmètre** : aucun fichier candidat-libre, scoring canonique, append-only, PDF ou compte protégé n'est modifié par la branche. Aucun chemin hôte ou de production n'est introduit ; l'E2E utilise seulement une racine interne jetable.

## Preuve sur clone éphémère

Un clone Git neuf de la branche a été créé dans un espace temporaire isolé, exécuté dans le harness root-only contre PostgreSQL jetable, puis détruit avec toutes ses ressources de test.

La suite réelle a exécuté le CLI `npm --silent run npc:tombstone` et vérifié :

- la création et la relecture de l'export JSON chiffré en `0600` avant mutation ;
- le refus sans mutation lorsque le nombre de pièces ou les identités/statuts attendus divergent ;
- le rollback lorsque la transition terminale échoue ;
- l'audit exact et l'absence de texte métier en clair ;
- la deuxième exécution idempotente et les appels concurrents sérialisés.

Résultat : **3 suites, 47 tests passés, 0 échec, 0 skip**. Le clone et toutes les ressources jetables ont été supprimés.

## Tests exécutés

- Unitaires complets : **783 suites, 8 731 tests passés**, 7 snapshots, 0 échec, 0 skip.
- Intégration complète : **35 suites, 248 tests passés**, 0 échec, 0 skip.
- Base réelle `test:db` : **11 suites, 179 tests passés**, 0 échec, 0 skip.
- NPC PostgreSQL réel sur clone : **3 suites, 47 tests passés**, 0 échec, 0 skip (relance ciblée incluse dans la lane d'intégration, comptée séparément comme preuve opérationnelle).
- Playwright E2E complet : **931 tests passés** en 16 minutes, 0 échec, 0 skip.
- Typecheck : succès, code 0.
- Lint : succès, code 0. Les 30 avertissements restants sont préexistants dans le module candidat-libre, non modifié par cette branche.
- Build de release complet sur clone : succès; traces, arbre standalone et manifestes valides; aucune donnée runtime embarquée.
- Scan sécurité dépôt : aucune clé privée, aucune infrastructure publique, aucun secret Telegram.
- Scan valeurs en dur : 0 valeur hors sources canoniques.
- Scan quarantaines : 2 371 fichiers suivis, aucune quarantaine inconditionnelle ni focus.
- `git diff --check` : succès.

Décompte des lanes complètes non filtrées : **10 089 exécutions de tests réussies** (unitaires + intégration + `test:db` + E2E). Les 47 tests NPC réels ont ensuite été rejoués séparément sur le clone de preuve.

## Fichiers modifiés pendant la finalisation

- `services/npc-worker/job-outcomes.ts`
- `__tests__/integration/npc-worker-integrity.real.test.ts`
- `__tests__/scripts/run-npc-real-db-tests.test.ts`
- `.github/workflows/ci.yml`
- `lib/npc/tombstone/export.ts`
- `__tests__/architecture/npc-storage-contract.test.ts`
- `__tests__/npc/storage-root.test.ts`
- `scripts/testing/run-npc-real-db-tests.sh`
- `README.md`
- `docs/runbooks/npc-storage.md`
- ce rapport de validation

## Risques restants

- La commande de tombstone est volontairement inutilisable sans manifeste exact, UID 0, export root privé hors release et clé de chiffrement valide. Ces préconditions doivent être préparées après déploiement, sans assouplir les gardes.
- Les avertissements Edge Runtime de `jose`/`next-auth`, la dépréciation de `next lint` et les avertissements candidat-libre sont préexistants et non bloquants pour cette PR.
- Aucun tombstone n'a été exécuté en production. Aucun merge ni déploiement n'est inclus dans cette validation.

## Rollback

Avant merge, fermer la PR ou réverter les commits de la branche suffit. Après merge, réverter les commits applicatifs est possible, mais les ajouts de schéma sont volontairement conservés : la migration est additive et ne prévoit aucune suppression de valeur d'enum ou de colonne.
