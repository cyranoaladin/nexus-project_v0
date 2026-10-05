# Runbook — sortie du blocage P3018 par `migrate resolve --applied` (lot 2026-10)

## Contexte

Le journal `_prisma_migrations` de la base de production porte trois migrations marquées
`rolled_back_at` non nul / `finished_at` nul alors que **leurs effets existent déjà** (appliquées
à la main en 2026-08). `prisma migrate deploy` les rejoue, échoue `P3018 … already exists`
et **n'applique aucune nouvelle migration** (reproduit en répétition sur base jetable, 2026-10-05 :
0 migration du lot appliquée avant l'arrêt).

Migrations concernées :

| Migration | Effets attendus (exhaustif) |
|---|---|
| `20260808130000_add_user_document_unavailable_reason` | colonne `user_documents."unavailableReason"` TEXT NULL |
| `20260824090000_add_profil_candidat` | types `CandidateLevel`, `Modalite`, `BrancheBascule` ; table `profils_candidats` (+ index `profils_candidats_contactLeadId_idx`, contraintes/FK du fichier) ; colonnes `quotes."profilId"`, `"snapshotCarte"`, `"snapshotRegles"` |
| `20260830150000_add_lva_lvb_languages` | valeurs d'enum `Subject` : `ARABE`, `ITALIEN`, `RUSSE`, `ALLEMAND`, `PORTUGAIS` (+ toute valeur listée dans le fichier) |

## Interdits

- **Jamais** de `migrate resolve --applied` automatique ou en lot : une migration dont les objets
  réels ne correspondent pas **strictement** au SQL du fichier ne doit pas être marquée appliquée.
- Jamais de `prisma migrate deploy` tant que le préflight
  (`scripts/db/preflight-2026-10-go-live.sh`) n'est pas PASS.
- Jamais sans sauvegarde préalable vérifiée ni approbation humaine nominative.

## Procédure, migration par migration

1. **Sauvegarde préalable** : dump récent vérifié (intégrité) AVANT toute écriture de journal.
2. **État du journal** (lecture seule) :
   `SELECT migration_name, checksum, started_at, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '<nom>' ORDER BY started_at;`
   Consigner la sortie. Le `checksum` attendu est le sha256 du fichier
   `prisma/migrations/<nom>/migration.sql` du commit déployé (`sha256sum` — comparer).
3. **Inventaire des objets réels**, un par un, contre le tableau ci-dessus :
   - colonne : `information_schema.columns` (nom, type, nullabilité, défaut) ;
   - table : `information_schema.tables` + définition complète (`\d+` : colonnes, index,
     contraintes, FK) comparée ligne à ligne au `CREATE TABLE` du fichier ;
   - enum : `SELECT enumlabel FROM pg_enum JOIN pg_type … WHERE typname='Subject'` —
     toutes les valeurs du fichier présentes ;
   - index/contraintes/triggers nommés dans le fichier : présence ET définition
     (`pg_get_indexdef`, `pg_get_constraintdef`).
4. **Décision** :
   - tous les objets présents et conformes → `npx prisma migrate resolve --applied <nom>` ;
   - objet manquant → appliquer le SQL manquant via
     `psql -X -v ON_ERROR_STOP=1 -1 -f <migration.sql>` (une transaction) **si** le reste est
     absent aussi, sinon appliquer uniquement le fragment manquant, consigné, puis `resolve --applied` ;
   - objet présent mais **divergent** du SQL (type, contrainte, défaut différent) → STOP,
     arbitrage humain ; ne pas marquer appliquée.
5. **Journal de l'opération** : qui, quand, sortie des commandes, dans le dossier d'exploitation.
6. **Contrôles après les trois résolutions** :
   - `npx prisma migrate status` → « Database schema is up to date! » n'est PAS attendu
     (les nouvelles migrations du lot restent en attente) ; attendu : plus aucune ligne en échec ;
   - préflight PASS ;
   - vérification fonctionnelle ciblée (lecture d'un document utilisateur, d'un devis, d'une
     matière de langue) sans affichage de PII.
7. Seulement ensuite : `prisma migrate deploy` du lot.

Point mesuré en répétition : après un `resolve --applied` légitime, l'ancienne ligne
`rolled_back_at` **reste** dans le journal à côté de la nouvelle ligne appliquée ; seul le dernier
enregistrement de chaque migration fait foi (le préflight juge ainsi).

## Rollback / forward-fix du lot 2026-10

Les 13 migrations du lot sont additives (aucun DROP de colonne/table, les `DROP CONSTRAINT`
sont des remplacements de CHECK recréés dans la même transaction). Stratégie :

1. **Rollback applicatif** (re-pointer la release précédente) : sûr, le schéma migré est
   rétrocompatible — l'ancien client Prisma sélectionne ses colonnes explicitement et les
   nouvelles colonnes sont NULLables ; vérifié en répétition (insertions aux formes de l'ancienne
   application acceptées par le nouveau schéma).
2. **Forward-fix** pour une migration additive défectueuse : `migrate resolve --rolled-back <nom>`
   après échec (la transaction a annulé ses effets — vérifié : interruption en plein
   `CREATE TABLE` ne laisse rien), corriger, redéployer.
3. **Restauration** de sauvegarde : uniquement corruption ou incident majeur.
