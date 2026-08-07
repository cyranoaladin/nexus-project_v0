# Rollback — migration `20260807140000_add_candidate_diagnostic`

## Contexte

La migration est purement additive : 4 `CREATE TYPE`, 4 `CREATE TABLE` (`candidate_diagnostics`,
`candidate_diagnostic_modules`, `candidate_diagnostic_documents`, `candidate_diagnostic_audit_logs`),
des index sur ces seules nouvelles tables, et des `ALTER TABLE ... ADD CONSTRAINT` qui ajoutent des
clés étrangères **depuis** les nouvelles tables **vers** `users`/`students` (aucune modification des
tables existantes elles-mêmes). Prisma ne génère pas de down-migration : ce document est le SQL de
revert et l'ordre des opérations.

Le flag produit `CANDIDATE_DIAGNOSTIC_ENABLED` est OFF partout, y compris en prod (`lib/diagnostics/
candidat-libre/feature-flag.ts`) — aucune route ne lit/écrit ces tables en usage normal tant qu'il
n'est pas explicitement activé (prouvé par `__tests__/api/diagnostics/candidat-libre/
feature-flag-dark.test.ts`, 24 tests : chaque route renvoie 404 avant toute résolution de rôle).

## Ordre des opérations : code d'abord, schéma ensuite

**Revert du déploiement applicatif d'abord, revert du schéma SQL ensuite — jamais l'inverse.**

Raison : le flag OFF garantit qu'en fonctionnement normal aucune requête ne touche ces tables, mais
un rollback n'est pas un fonctionnement normal. Le Prisma Client généré par la release à annuler
contient ces modèles dans son schéma introspecté même si aucune route ne les appelle ; un flip
accidentel du flag (erreur humaine, variable d'environnement mal propagée) pendant la fenêtre de
rollback ferait passer des requêtes contre des tables sur le point de disparaître. Revenir d'abord au
code de la release précédente élimine tout risque de collision, quelle que soit l'hypothèse sur le
flag :
1. Rebasculer `<APP_DIR>` vers la release précédente (celle sans le lot candidat libre), redémarrer
   `<APP_PROCESS>`, attendre la disponibilité, prouver une connexion réelle — même protocole que le
   rollback de l'incident du 3 août (`docs/audits/2026-08-03-incident-authentification.md`).
2. Une fois le code revenu en arrière confirmé (aucun Prisma Client connaissant `CandidateDiagnostic*`
   n'est plus en cours d'exécution), exécuter le SQL de revert ci-dessous.
3. Marquer la migration comme annulée dans l'historique Prisma pour que `migrate deploy` reste cohérent :
   ```bash
   npx prisma migrate resolve --rolled-back 20260807140000_add_candidate_diagnostic
   ```

Si pour une raison opérationnelle le schéma doit être annulé avant le code (non recommandé), le pire
cas est un 500 Prisma explicite sur les tables manquantes — fail-closed, pas de corruption silencieuse —
mais l'ordre recommandé reste code puis schéma.

## SQL de revert

Ordre imposé par les FK : tables filles d'abord (elles référencent `candidate_diagnostics`), table
mère ensuite, puis les types énumérés une fois qu'aucune colonne ne les utilise plus.

```sql
BEGIN;

DROP TABLE IF EXISTS "candidate_diagnostic_audit_logs";
DROP TABLE IF EXISTS "candidate_diagnostic_documents";
DROP TABLE IF EXISTS "candidate_diagnostic_modules";
DROP TABLE IF EXISTS "candidate_diagnostics";

DROP TYPE IF EXISTS "CandidateDiagnosticActorRole";
DROP TYPE IF EXISTS "CandidateDiagnosticDocumentStatus";
DROP TYPE IF EXISTS "CandidateDiagnosticModuleStatus";
DROP TYPE IF EXISTS "CandidateDiagnosticStatus";

COMMIT;
```

`DROP TABLE` sans `CASCADE` : si l'ordre ci-dessus est respecté, chaque `DROP TABLE` s'exécute sans
dépendance restante (les tables filles sont tombées avant la table mère). Ne pas ajouter `CASCADE` —
un `CASCADE` masquerait une erreur d'ordre au lieu de la faire échouer bruyamment.

Aucune table préexistante (`users`, `students`) n'est modifiée par ce revert : le rollback ne fait que
supprimer ce que la migration a créé, il ne touche à aucune donnée hors du périmètre candidat libre.

## Vérification post-rollback

```bash
npx prisma migrate status
# attendu : la migration 20260807140000_add_candidate_diagnostic n'apparaît plus comme appliquée
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
```

Avant tout revert réel en production : rejouer cette procédure sur la copie anonymisée de production
utilisée pour le Gate 2 (dry-run), dans le même ordre — CREATE puis DROP — pour prouver l'aller-retour
complet sur un clone fidèle, pas seulement en lecture du SQL.
