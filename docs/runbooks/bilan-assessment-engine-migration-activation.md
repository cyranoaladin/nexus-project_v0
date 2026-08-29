# Runbook — migration et activation du moteur canonique

## Portée

Ce document prépare une activation ultérieure. Il n'autorise ni déploiement,
ni migration production, ni activation de flag.

## Migrations additives

Ordre de `prisma migrate deploy` :

1. `20260730_00_prepare_report_review_actor_backfill` ;
2. `20260730_add_canonical_assessment_attempt_statuses` ;
3. `20260730_add_canonical_assessment_engine_v1` ;
4. `20260730_add_canonical_report_review_actor` ;
5. `20260730_zz_finalize_report_review_actor_backfill`.

Les migrations de préparation/finalisation suspendent puis restaurent le
trigger append-only afin de renseigner `reviewerUserId` sur les revues
historiques depuis leur coach. Aucun maximum de score historique inconnu n'est
inventé.

## Préflight

1. Sauvegarde et plan de restauration validés par l'exploitation.
2. SHA de release approuvé.
3. `npx prisma validate` et `npx prisma generate` verts.
4. Fresh et upgrade par `prisma migrate deploy` verts sur bases jetables.
5. PostgreSQL compatible extensions `vector` et `btree_gist`.
6. Redis/Upstash distribué testé ; aucun fallback mémoire production.
7. SMTP et outbox vérifiés.
8. Toutes les validations pédagogiques nominatives requises liées aux hashes.
9. Flags tous faux.

## Ordre d'activation

1. fusionner le code approuvé ;
2. déployer avec tous les flags faux ;
3. appliquer `prisma migrate deploy` dans une fenêtre autorisée ;
4. vérifier migration et index ;
5. configurer/tester Redis/Upstash et SMTP ;
6. exécuter les smoke tests internes ;
7. valider nominativement le sous-ensemble pédagogique ;
8. ouvrir un pilote borné seulement après décision humaine ;
9. activer le flag canonique de manière contrôlée ;
10. surveiller erreurs, files, outbox et latences.

`BILAN_MATHS_TERMINALE_PILOT_ENABLED` ne contourne jamais
`PUBLICATION_APPROVED`.

## Compatibilité

La migration est additive. Les modèles legacy restent disponibles. Le champ
JSON legacy de tentative n'est pas une source v1 et reste `{}` pour les
nouvelles tentatives. Les données existantes ne sont ni supprimées ni
réinterprétées.

## Retour arrière

1. remettre tous les flags faux ;
2. arrêter les workers du moteur ;
3. laisser les tables et données additives en place ;
4. révoquer les publications incorrectes ;
5. revenir au code précédent si celui-ci reste compatible ;
6. créer une migration compensatoire si le schéma doit changer.

Ne pas exécuter de rollback SQL destructif et ne jamais utiliser
`prisma db push`.

## Variables

Les noms sans secret sont centralisés dans `.env.example` :

- `BILAN_CANONICAL_INTAKE_ENABLED` ;
- `BILAN_MATHS_TERMINALE_PILOT_ENABLED` ;
- `BILAN_PROVISIONAL_RESULTS_ENABLED` ;
- `BILAN_TEAM_REALTIME_ENABLED` ;
- `BILAN_LLM_ENRICHMENT_ENABLED` ;
- `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` selon le backend ;
- `BILAN_TEAM_NOTIFICATION_EMAIL` ;
- configuration SMTP existante du dépôt.
