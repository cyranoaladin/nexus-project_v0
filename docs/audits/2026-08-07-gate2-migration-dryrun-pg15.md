# Gate 2 — dry-run de migration `20260807140000_add_candidate_diagnostic` sur pg15

## Date

2026-08-07.

## Pourquoi ce redo

Le dry-run précédent (référencé dans `STATUT-candidat-libre.md`) a tourné sur `pgvector/pgvector:pg16`.
La version réelle de production n'est pas `pg16` : `docs/audits/2026-08-02-a82-migration-passation-dry-run.md`
établit `pgvector/pgvector:pg15` par accès SSH direct au host de production (`pg_dump` réel, image du
conteneur vérifiée sur le serveur). Le dry-run précédent était donc sur la mauvaise version majeure.

Décision prise avec le responsable : pas besoin d'un dump de production restauré pour ce redo. La
migration est confirmée additive (voir plus bas) — aucune donnée existante n'est lue, modifiée ou
verrouillée d'une façon qui dépendrait du volume de lignes dans `users`/`students`. Ce qui manquait était
la version majeure, pas le volume de données.

## Méthode

`docker run pgvector/pgvector:pg15` (image identique à celle confirmée en prod), `--tmpfs` pour les
données (jetable), port éphémère local. Rejeu de `npx prisma migrate deploy` : 61 migrations existantes de
`main` (post-#98) + `20260807140000_add_candidate_diagnostic` par-dessus, dans le même ordre qu'un
déploiement réel.

## Résultat

```
PostgreSQL 15.15 (Debian 15.15-1.pgdg12+1) on x86_64-pc-linux-gnu
62 migrations appliquées, dont la nôtre en dernier — succès, 0 erreur.
prisma migrate deploy (62 migrations) : 1.62 s temps réel total (élapsed wall-clock).
```

### Durée — migration candidat libre isolée

Rejouée seule (`psql -f migration.sql`, `\timing on`) sur une base déjà à jour des 61 autres migrations :
**12.3 ms de temps d'exécution SQL cumulé** sur les 26 instructions (4 `CREATE TYPE`, 4 `CREATE TABLE`,
10 `CREATE INDEX`, 8 `ALTER TABLE ... ADD CONSTRAINT`). Négligeable, cohérent avec des tables neuves vides.

### Nature des locks pris — vérifié empiriquement, pas seulement déduit

4 des 8 `ADD CONSTRAINT` référencent des tables **existantes** (`users`, `students`), potentiellement
peuplées en prod : `candidate_diagnostics_studentId_fkey` → `students`, `candidate_diagnostics_createdById_fkey`
→ `users`, `candidate_diagnostic_documents_uploadedById_fkey` → `users`,
`candidate_diagnostic_audit_logs_actorId_fkey` → `users`.

Vérifié en ouvrant une transaction non commitée et en lisant `pg_locks` pendant qu'elle est en cours (puis
`ROLLBACK`, rien de persisté) :

```
 relname                | mode                   | granted
------------------------+------------------------+--------
 candidate_diagnostics   | ShareRowExclusiveLock  | t
 users                   | ShareRowExclusiveLock  | t
```

`ShareRowExclusiveLock` sur `users` (la table référencée) : bloque les écritures concurrentes
(INSERT/UPDATE/DELETE) sur `users` pendant la durée de l'instruction, **ne bloque pas les lectures**
(`SELECT`). La validation de la contrainte parcourt la table qui **reçoit** la FK
(`candidate_diagnostics`, `candidate_diagnostic_documents`, `candidate_diagnostic_audit_logs` — toutes
vides à la création), pas la table référencée (`users`/`students`) — la durée du verrou est donc bornée
par la taille des nouvelles tables (zéro ligne), indépendante du volume réel de `users`/`students` en
production. C'est la preuve technique précise de ce que l'additivité impliquait déjà : le volume de
données de prod n'a pas d'effet sur la durée ou la nature de ce verrou.

### `CREATE INDEX` non concurrents sur table peuplée — confirmé absent

Les 10 `CREATE INDEX` de cette migration portent tous sur les 4 tables **nouvellement créées** par cette
même migration (donc vides au moment de leur création) — aucun ne porte sur `users`, `students`, ni sur
aucune autre table préexistante. Aucun `CREATE INDEX CONCURRENTLY` n'est nécessaire ici : la forme non
concurrente est le choix correct sur une table vide (plus rapide, verrou sans conséquence puisque rien
d'autre n'écrit encore dans une table qui vient d'être créée dans la même transaction).

### `migrate diff` — un écart trouvé, préexistant sur `main`, sans rapport avec cette migration

```
[*] Changed the `eam_progress` table
  [+] Added index on columns (user_id)
```

`prisma/schema.prisma:2189` déclare `@@index([userId], map: "idx_eam_progress_user_id")`, mais la
migration `20260621100200_add_eam_progress_model` a explicitement **supprimé** cet index
(`DROP INDEX IF EXISTS idx_eam_progress_user_id`, jugé redondant avec l'index unique existant) sans que
`schema.prisma` soit mis à jour en conséquence. Vérifié présent tel quel sur `origin/main:prisma/schema.prisma`
(ligne 2181) — **préexistant, sans rapport avec le lot candidat libre**, non modifié par cette branche.
Sans impact fonctionnel connu (Prisma Client ne s'appuie pas sur cet index pour générer de requêtes
invalides), mais `prisma migrate diff --exit-code` ne peut pas être "propre" tant que ce n'est pas
corrigé sur `main` — signalé ici, non traité (hors périmètre de cette PR).

## Conclusion

Gate 2 fermée sur la version correcte (pg15). Additivité, durée, nature des locks et absence de
`CREATE INDEX` non concurrent sur table peuplée : tous vérifiés directement sur cette version, pas
seulement rapportés depuis le run pg16 précédent.
