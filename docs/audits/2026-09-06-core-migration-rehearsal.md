# Répétition de migration CORE — Tâche 18

## Date

7 septembre 2026. Base applicative : `feat/core-go-live-family-academic-planning-20260906`
au commit `8b40470f0`. Base de comparaison (« application antérieure ») :
`origin/main` au commit `95f518e31` (`git merge-base origin/main HEAD`).

## Verdict

```
FRESH_DB_MIGRATION_REHEARSAL = PASS
SYNTHETIC_DB_MIGRATION_REHEARSAL = PASS
PRODUCTION_CLONE_MIGRATION_REHEARSAL = BLOCKED (précondition d'exécution invalidée avant toute migration)
TASK_18 = BLOCKED — voir « Cause exacte du blocage » et « Décision requise »
```

Aucune migration n'a été appliquée à un clone de production réel. La
sauvegarde authentifiée a été restaurée, son état a été vérifié de manière
indépendante avant migration comme l'exige le contrat d'autorisation, et
cette vérification a échoué : l'environnement a été immédiatement arrêté et
détruit sans qu'aucune migration ne soit exécutée contre des données réelles.
Les deux répétitions non sensibles (base vide, base synthétique) ont, elles,
été menées à leur terme avec un verdict PASS complet.

## Correction d'un écart de comptage dans l'autorisation

L'autorisation numérotée transmise pour cette tâche évoque « les cinq
migrations de la branche » (sections 4, 5 et 9). Vérification indépendante
faite (`git merge-base origin/main HEAD` puis diff des dossiers de
`prisma/migrations/`) : cette branche n'ajoute qu'**une seule** migration à
`origin/main` — `20260906200000_core_family_academic_planning_expand`. Les
trois autres migrations nommément citées par le contexte technique
(`20260906120000_parent_phone_identity`,
`20260906120100_optional_subscription_request_email`,
`20260906130000_parent_email_activation_invalidation`) sont déjà présentes
sur `origin/main` (mergées via la PR #212, intégration WhatsApp parent) —
elles ne sont « nouvelles » que relativement à la sauvegarde du 3 septembre,
pas relativement à la branche. Il n'y a donc que **quatre** migrations
candidates entre la sauvegarde et `origin/main`, jamais cinq, et une seule
appartient réellement au périmètre de cette branche. Cet écart de comptage
n'a bloqué aucune étape en lui-même — l'ensemble des migrations concernées
était sans ambiguïté et corroboré par deux méthodes indépendantes — mais il
est documenté ici pour la traçabilité, conformément à l'exigence de ne
jamais lisser silencieusement une incohérence du contrat d'autorisation.

## Isolation (les trois environnements)

Aucun environnement existant sur la machine n'a été touché :
`nexus-pg15-prodclone`, `nexus-pg15-empty` et `nexus-postgres-test`
(convention `docker-compose.test.yml` de cette branche) n'ont fait l'objet
d'aucune commande — ni lecture, ni arrêt, ni modification.

Pour chacun des trois environnements créés pour cette tâche :

- nom de conteneur unique, préfixé `nexus-core-migration-rehearsal-<lane>-<run-id>` ;
- volume Docker dédié, jamais un volume préexistant ;
- réseau Docker isolé et dédié (`nexus-core-migration-rehearsal-net-<run-id>`),
  aucun autre conteneur attaché ;
- liaison `127.0.0.1` uniquement — aucun port exposé publiquement (`0.0.0.0`) ;
- identifiants (utilisateur/mot de passe Postgres) générés aléatoirement
  pour ce run, jamais réutilisés d'ailleurs ;
- image `pgvector/pgvector:pg15` (même famille que
  `docker-compose.test.yml`, extension `vector` requise par le schéma) ;
- détruits (conteneur + volume, et réseau une fois les trois lanes closes)
  à l'issue de cette tâche.

## Lane 1 — Base vide (« fresh »)

Conteneur `nexus-core-migration-rehearsal-fresh-<run-id>`, volume dédié,
port local `15511` (uniquement `127.0.0.1`).

- PostgreSQL 15.15 (Debian), extensions `btree_gist`, `vector` créées avant migration.
- `npx prisma migrate deploy` depuis zéro : **106 migrations** appliquées
  sans erreur (liste complète de `prisma/migrations/`, jusqu'à
  `20260906200000_core_family_academic_planning_expand`).
- Tables publiques après migration : **112**.
- Idempotence : second `npx prisma migrate deploy` immédiat →
  `No pending migrations to apply.` — **PASS**.
- Aucune ligne, aucune donnée : aucun contrôle métier applicable sur cette
  lane au-delà du succès structurel des migrations.

**FRESH_DB_MIGRATION_REHEARSAL = PASS.**

## Lane 2 — Base existante mais entièrement synthétique

Conteneur `nexus-core-migration-rehearsal-synthetic-<run-id>`, volume dédié,
port local `15512`. Aucune donnée réelle n'entre dans cette lane — elle
n'est donc pas soumise aux contraintes de protection des données réelles de
la section 2 de l'autorisation (elles ne s'appliquent qu'à la sauvegarde de
production).

Procédure (entièrement rejouée par `scripts/core/rehearse-core-migration.sh`,
exécutée réellement pour cette preuve, pas seulement rédigée) :

1. Worktree Git temporaire au commit parent `95f518e31` (« application
   antérieure »), client Prisma propre généré depuis ce commit.
2. `prisma migrate deploy` depuis ce worktree : 105 migrations de base
   appliquées (tout `origin/main` jusqu'à `20260906130000_parent_email_
   activation_invalidation` inclus).
3. Semis synthétique minimal (`scripts/core/rehearsal-seed-synthetic.ts`,
   exécuté avec le client Prisma ANTÉRIEUR, aucune donnée réelle) : 6
   utilisateurs, 2 élèves, 2 coachs, 3 `CoachStudentAssignment`, 2
   `SessionBooking` — construit délibérément pour couvrir les trois issues
   possibles du calcul de périmètre de cours :
   - un cas à résolution unique (NSI/Première → une seule candidate) ;
   - un cas ambigu (MATHEMATIQUES/Première → tronc commun ET spécialité,
     deux candidats) ;
   - un cas sans candidat (PHYSIQUE_CHIMIE sans inscription correspondante).
4. Depuis le worktree courant de la branche : `prisma migrate deploy`
   applique la migration restante (`...core_family_academic_planning_expand`).
   **PASS**, sans erreur.
5. Second `prisma migrate deploy` immédiat → `No pending migrations to
   apply.` — **idempotence PASS**.

### Contrôles post-migration (agrégats et identifiants techniques uniquement)

`scripts/core/report-core-migration-state.ts` AVANT `scripts/core/
backfill-assignment-course-keys.ts --apply` :

| Compteur | AVANT | APRÈS backfill | ATTENDU | VERDICT |
|---|---|---|---|---|
| `ACTIVE_ASSIGNMENT_UNRESOLVED` | 3 | 1 | passe de 3→1 (2 assignations résolues : 1 AUTO, 1 AMBIGUOUS) | PASS |
| `ACTIVE_ASSIGNMENT_AMBIGUOUS` | 0 | 1 | 1 (le cas MATHEMATIQUES construit exprès) | PASS |
| `activeAssignmentsByCourseScopeState.BACKFILL_AUTO` | 0 | 1 | 1 (le cas NSI construit exprès) | PASS |
| `ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE` | 0 | 0 (puis 1 après l'écriture de compatibilité, voir plus bas) | 0 sur les réservations semées avant migration | PASS |
| `ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE` | 0 | 0 (idem) | idem | PASS |

Le backfill applicatif (`scripts/core/backfill-assignment-course-keys.ts
--apply`) : `scanned=3, auto=1, unresolved=1, ambiguous=1, changed=2`.
Rejoué immédiatement après (`changed=0`) — **idempotence du backfill
PASS**, jamais de choix arbitraire sur les 2 cas non-`AUTO` (conforme à la
non-devinette documentée dans `backfill-assignment-course-keys.ts`).

Le backfill de `studentProfileId`/`coachProfileId` intégré à la migration
elle-même a correctement rempli les deux `SessionBooking` semées avant
migration (une historique `COMPLETED`, une future `SCHEDULED`) : 0 orpheline
sur les deux gates de résolution de profil, avant toute écriture
supplémentaire.

### Test de rétrocompatibilité / retour arrière

`scripts/core/rehearsal-rollback-compat-check.ts`, exécuté avec le client
Prisma **ANTÉRIEUR** (généré au commit `95f518e31`, avant toute colonne de
cette branche) contre la base synthétique **déjà migrée** (schéma étendu) :

- lecture réussie des enregistrements pré-migration (6 utilisateurs, 2
  élèves, 2 assignations… — décompte exact dans le JSON d'évidence) à
  travers le client antérieur, sans erreur liée aux colonnes additives ;
- écriture réussie d'un nouveau `SessionBooking` via ce même client
  antérieur (qui ignore totalement `studentProfileId`, `coachProfileId`,
  `academicCourseKey`, etc.) contre le schéma étendu, puis relecture
  correcte de la ligne écrite.

**Conséquence attendue et documentée, pas une anomalie** : cette écriture
volontaire via le client antérieur, postérieure à la migration, laisse
`studentProfileId`/`coachProfileId` NULL sur cette nouvelle ligne — d'où
`ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE=1` et `..._COACH_PROFILE=1`
dans le rapport final de cette lane. C'est exactement le comportement que
ces deux gates existent pour détecter : du code applicatif qui ne connaît
pas encore le schéma étendu continue d'écrire des lignes valides, non
cassées, mais dont la résolution de profil reste à faire avant de basculer
un lecteur dessus. Ceci **confirme empiriquement** le principe additif
« PAS DE CONTRACT DESTRUCTIF » : le code antérieur n'est ni cassé en
lecture, ni cassé en écriture par cette migration.

**SYNTHETIC_DB_MIGRATION_REHEARSAL = PASS** (migration, idempotence,
contrôles post-migration, tests métier et rétrocompatibilité tous PASS).

## Lane 3 — Clone de production réel

### Identification de la sauvegarde

- SHA256 : `e452d804abd269d821dea2ace70250f34ced2bb57bef6a1552647169394ffd8f`
  (vérifié par recalcul indépendant avant toute opération — identique à la
  valeur autorisée).
- Format `pg_dump` custom, 866 entrées de TOC, généré depuis PostgreSQL
  15.17, `dbname: nexus_prod` (nom interne à l'archive, sans rapport avec
  la base cible du rehearsal).
- Le fichier source n'a jamais été ouvert en écriture : seule une copie
  (`docker cp`, une lecture) a été faite vers le conteneur isolé ; taille,
  permissions et date de modification du fichier source vérifiées
  identiques avant et après l'opération.

### Restauration

Conteneur `nexus-core-migration-rehearsal-prodclone-<run-id>`, volume
dédié, port local `15503`. Extensions `btree_gist` et `vector` créées avant
restauration. `pg_restore --no-owner --no-acl` (le rôle `nexus_admin`
interne à l'archive n'a jamais été recréé ni utilisé pour se connecter :
tous les objets appartiennent à l'identifiant jetable de ce run — aucun
identifiant de production n'a servi au-delà de sa présence passive dans le
contenu de l'archive elle-même).

Un seul avertissement pendant la restauration, non lié aux données : l'archive
contient un ordre de dépendance interne inversé entre deux fonctions liées au
householding (`nexus_household_name_key` référencée avant
`nexus_normalize_name_part` dans la table des matières de l'archive elle-même
— antérieur à toute action de ce rehearsal), provoquant l'échec d'un unique
`CREATE INDEX` pendant la passe automatique. Les deux fonctions existant à la
fin de la restauration, l'index a été recréé manuellement à l'identique
(`CREATE INDEX users_household_name_key_idx ...`, DDL repris tel quel de la
définition de l'archive) : `0` index invalide, `0` contrainte non validée
après cette étape.

### Baseline structurelle et agrégée (aucune ligne utilisateur, aucun nom, aucun email)

- PostgreSQL 15.15 (Debian). Extensions : `btree_gist 1.7`, `plpgsql 1.0`, `vector 0.8.1`.
- Tables publiques : 97. Index : 343. Séquences : 0. Contraintes FK : 137,
  PK : 97, UNIQUE : 3, CHECK : 837.
- 0 index invalide, 0 contrainte non validée.
- Compteurs métier (agrégats uniquement) : `users`=317, `parent_profiles`=101,
  `students`=192, `coach_profiles`=20, `SessionBooking`=26,
  `coach_student_assignments`=19.
- 0 élève orphelin (`students.userId` sans `users` correspondant), 0
  réservation orpheline (`SessionBooking.studentId` sans `users`
  correspondant).
- La table `student_academic_enrollments` **n'existe pas encore** dans cet
  état restauré — signal supplémentaire, indépendant, de l'ampleur réelle de
  l'écart (voir ci-dessous).

### Cause exacte du blocage — précondition invalidée

La section 4 de l'autorisation impose de revérifier **indépendamment**,
avant toute migration, que `20260903190000_add_planning_studio` est bien la
dernière migration présente dans la sauvegarde. Cette revérification a été
faite par requête directe sur `_prisma_migrations` de la base restaurée
(donnée technique, aucun contenu utilisateur) :

```
SELECT migration_name FROM _prisma_migrations
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
ORDER BY migration_name DESC LIMIT 1;
→ 20260830150000_add_lva_lvb_languages
```

**Cette précondition est fausse pour ce fichier de sauvegarde précis.** La
dernière migration réellement appliquée dans l'archive est
`20260830150000_add_lva_lvb_languages` (30 août), pas
`20260903190000_add_planning_studio` (3 septembre). L'écart entre l'état de
l'archive et `prisma/migrations/` de la branche courante n'est pas de 1, 4
ou 5 migrations : il est de **18 migrations**, dont 14 appartiennent à des
lots déjà mergés sur `origin/main` mais totalement étrangers au périmètre de
cette tâche (`academic_enrollment_ssot`, les dix migrations `aria_*`,
`fix_household_name_key_search_path`,
`aria_canonical_grant_invoice_uniqueness`), avant même
`add_planning_studio` et les quatre migrations propres à cette tâche.
Aucune migration présente dans l'archive n'est absente du dossier courant
(vérifié dans les deux sens — aucune incohérence de renommage).

Recoupement : le fichier `prod_db_migrations.psv` déjà présent dans le
dossier d'audit source (capture live de `_prisma_migrations`, distincte de
l'archive `pg_dump` elle-même) contient lui `add_planning_studio` comme
dernière ligne. Les deux fichiers proviennent très probablement du même
créneau d'audit (3 septembre, à ~20 minutes d'écart d'après leurs horodatages
de fichier) : l'archive `pg_dump` (créée en interne à 19:50 CET selon son
propre en-tête) a capturé un instantané transactionnel légèrement antérieur
au déploiement réel de `add_planning_studio`, tandis que la requête live
qui a produit le `.psv` a eu lieu après ce déploiement. Les deux fichiers
sont chacun cohérents pour leur instant de capture respectif ; ils ne
décrivent simplement pas le même instant.

Conformément à l'instruction explicite de ne jamais deviner sur ce point
précis de la tâche et de m'arrêter dès qu'une précondition qualifiée de
« dure » ne tient pas à la vérification indépendante : **aucune migration
n'a été appliquée** contre cette base. L'environnement a été détruit
immédiatement après la capture de la baseline ci-dessus (conteneur, volume ;
le réseau a été détruit avec les deux autres lanes).

### Décision requise avant de rejouer cette lane

Options possibles, à trancher par l'opérateur humain — aucune n'a été
choisie unilatéralement :

1. Rejouer cette lane avec le fichier de sauvegarde déjà autorisé, mais en
   appliquant les **18** migrations réellement en attente (rattrapage complet
   jusqu'à `origin/main` + la migration de cette branche), et non les 4/5
   nommées dans l'autorisation — élargit le périmètre réellement testé sur
   des données réelles au-delà de ce que l'autorisation nomme explicitement.
2. Obtenir/produire une sauvegarde de production dont `_prisma_migrations`
   confirme réellement `20260903190000_add_planning_studio` comme dernière
   ligne (ex. capture postérieure au déploiement de cette migration), pour
   revenir à un écart de 4 migrations conforme à l'intention de
   l'autorisation.
3. Toute autre instruction explicite de l'opérateur humain.

Ce document ne préjuge d'aucune de ces options.

**PRODUCTION_CLONE_MIGRATION_REHEARSAL = BLOCKED** (précondition de la
section 4 invalidée à la revérification indépendante — aucune migration
exécutée, aucune donnée réelle modifiée).

## Teardown

Les trois conteneurs, les trois volumes et le réseau dédié ont été détruits
(`docker rm -f`, `docker volume rm`, `docker network rm`) immédiatement
après capture des preuves ci-dessus. Le worktree Git temporaire au commit
`95f518e31` a été supprimé (`git worktree remove --force`). Vérification
finale : aucune ressource Docker ni worktree Git nommé « rehearsal »/« old-app-checkout »
ne subsiste. Aucune copie supplémentaire des données de la sauvegarde n'a
été exportée hors de l'environnement détruit ; seuls les compteurs agrégés
et identifiants techniques ci-dessus sont conservés dans ce document.

## Fichiers livrés par cette tâche

- `scripts/core/rehearse-core-migration.sh` — orchestration rejouable des
  lanes « fresh » et « synthetic » (isolation complète, arrêt et
  destruction automatiques y compris en cas d'échec). Exécuté réellement
  pour produire les preuves ci-dessus (pas seulement rédigé).
- `scripts/core/rehearsal-seed-synthetic.ts` — fixture synthétique minimale
  utilisée par la lane « synthetic ».
- `scripts/core/rehearsal-rollback-compat-check.ts` — vérification de
  rétrocompatibilité utilisée par la lane « synthetic ».
- `docs/audits/2026-09-06-core-migration-rehearsal.md` — ce document.
- `CORE_GO_LIVE_GATE.md` — verdict de cette tâche enregistré.

Aucun fichier applicatif n'est modifié par cette tâche.
