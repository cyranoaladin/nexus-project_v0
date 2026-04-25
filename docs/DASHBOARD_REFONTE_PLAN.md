# Refonte dashboards Premiere EDS / STMG

Date de lancement: 25 avril 2026
Branche: `feat/dashboards-premiere-unification`
Prod cible: `https://nexusreussite.academy`
Serveur: `root@88.99.254.59`
Chemin applicatif attendu: `/var/www/nexus-project_v0`

## Objectif

Unifier les dashboards Nexus Reussite pour les profils Premiere EDS generale,
Premiere STMG, parent et coach, tout en preservant les flux existants:
authentification, RBAC, credits, paiements, ARIA, bilans, sessions et stages.

La cible principale est une experience eleve unique sous `/dashboard/eleve`,
avec un rendu distinct selon `gradeLevel`, `academicTrack`, `specialties` et
`stmgPathway`.

## Regles non negociables

- Aucune donnee pedagogique hardcodee dans les composants React.
- Une seule source de verite par entite metier: DB PostgreSQL ou
  `programmes/generated/*.json`.
- Progression eleve persistante en DB a chaque interaction significative.
- RAG reellement appele pour remediation, fiches flash et suggestions ARIA,
  avec affichage des sources.
- Charte graphique unique via `lib/theme/tokens.ts` et
  `lib/theme/variants.ts`.
- Branche dediee, commits atomiques, tests locaux avant push.
- Decisions pedagogiques non tranchees: documenter dans
  `docs/QUESTIONS_OPEN.md`.

## Phase 0 - Preparation

- Verifier l'etat de la prod et le dernier commit si le dossier serveur est un
  checkout Git.
- Creer un snapshot DB de prod via `ops/scripts/backup-db.sh`.
- Creer la branche `feat/dashboards-premiere-unification` depuis `origin/main`.
- Creer ce document et `docs/QUESTIONS_OPEN.md`.
- Aucun changement de code applicatif.

## Phase 1 - Schema eleve track-aware

Ajouter au modele `Student`:

- `gradeLevel`
- `academicTrack`
- `specialties`
- `stmgPathway`
- `updatedTrackAt`

Ajouter les enums Prisma `GradeLevel`, `AcademicTrack`, `StmgPathway`.
Mettre a jour seed, validation Zod, activation assistante et tests associes.

## Phase 2 - STMG diagnostics et skill graphs

Creer les mappings YAML et JSON generes pour:

- `maths_premiere_stmg`
- `sgn_premiere_stmg`
- `management_premiere_stmg`
- `droit_eco_premiere_stmg`

Ajouter les definitions diagnostiques STMG, une banque initiale Maths STMG et
les tests de chargement.

## Phase 3 - APIs track-aware et progression

Refondre `/api/student/dashboard` pour renvoyer un payload EDS ou STMG selon
le profil eleve. Ajouter les routes de progression/RAG STMG, factoriser les
hooks de progression et ajouter `ragSearchByTrack`.

## Phase 4 - Dashboard eleve unifie

Recomposer `/dashboard/eleve` autour de sections:

- cockpit
- contenus EDS ou STMG
- sessions
- ressources
- bilans
- trajectoire
- ARIA
- stages

Migrer le livret STMG en composant interne et rediriger les routes eleves
obsoletes vers la nouvelle structure.

## Phase 5 - Dashboard parent

Refondre `/dashboard/parent` en vue famille multi-enfants, avec drill-down
lecture seule par enfant, evolution NexusIndex/SSN/UAI, alertes consolidees et
comparaison cohorte.

## Phase 6 - Dashboard coach

Refondre `/dashboard/coach` en vue cohorte avec filtres EDS/STMG, alertes
pedagogiques, dossier eleve complet, sources RAG consultees, verbatims ARIA et
notes privees coach.

## Phase 7 - Hygiene, UI, accessibilite, docs

Supprimer les fichiers orphelins, eliminer le doublon de middleware, retirer
le residu Supabase, auditer les tokens/theme, renforcer accessibilite et mettre
a jour README, NAVIGATION_MAP, STMG_CONTENT_ROADMAP et ENVIRONMENT_REFERENCE.

## Phase 8 - E2E, deploiement, go-live

Creer les parcours Playwright EDS, STMG, parent multi-enfants et coach cohorte.
Apres validation locale, deployer en prod avec backup, migrations Prisma,
build, recreation du conteneur Next et E2E contre
`https://nexusreussite.academy`.

Le merge main et le go-live exigent confirmation explicite de Shark.

## Verification Phase 0

- Backup manuel cree le 25 avril 2026:
  `/opt/nexus/backups/nexus_db_20260425_093802.sql.gz`.
- Le dossier prod `/var/www/nexus-project_v0` ne contient pas de `.git` au
  lancement de la Phase 0. Ce point est trace dans `docs/QUESTIONS_OPEN.md`.
