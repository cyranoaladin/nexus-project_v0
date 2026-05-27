# Seed Data — Inventaire et conventions

**Date** : 2026-04-27
**Maintainer** : équipe Nexus

Ce document recense les scripts de seed Prisma, leur scope d'utilisation et les conventions à suivre pour en ajouter de nouveaux.

---

## 1. Seeds canoniques

| Script | Scope | Utilisation |
|---|---|---|
| `prisma/seed.ts` | seed principal (catégories : EDS, STMG, comptes coachs, parents, admin, etc.) | invoqué par `prisma db seed` (script `package.json`), Prisma migrate, CI |
| `scripts/seed-e2e-db.ts` | seed dédié e2e Playwright | invoqué dans `npm run test:e2e:setup` et CI Playwright |
| `scripts/seed-parent-dashboard-e2e.ts` | seed parent multi-enfants pour le dashboard parent | manuel ou CI E2E parent |
| `scripts/seed-qa-profiles.ts` | comptes de recette généralistes (admin, assistante, coach, parent, élève par track/level) | manuel staging/recette |
| `prisma/seed-demo-student.ts` | profil de recette anonymisé — élève EDS Terminale Maths + coach + bilan diagnostic exemple | `SEED_PASSWORD=changeme npx tsx prisma/seed-demo-student.ts` (local/staging uniquement) |

---

## 2. Seeds nominatifs supprimés

Les seeds et diagnostics nominatifs ne doivent pas être versionnés. Les jeux de recette doivent utiliser uniquement des profils fictifs et anonymisés.

---

## 3. Conventions

- Tout seed nouveau **doit être en TypeScript** (`.ts`), jamais en `.js`.
- Tout seed **doit être idempotent** : exécution répétée = état stable, via `upsert` Prisma.
- Tout seed **doit logger ses créations** (au minimum un summary par modèle).
- Tout seed **doit déclarer son scope** dans un commentaire d'en-tête : LOCAL | E2E | STAGING | PROD.
- Aucun seed ne doit appliquer de migration. Migrations = `prisma migrate deploy`.
- Aucun secret ou PII réelle dans les seeds (mots de passe = `password123` en local, hashés via bcrypt avant insertion).

---

## 4. Comptes de recette E2E (stable)

Provenance : `scripts/seed-e2e-db.ts` + `prisma/seed.ts`.

| Email | Rôle | Track / Level | Mot de passe |
|---|---|---|---|
| `student@example.com` | ELEVE | EDS Première Maths | `password123` |
| `eleve.eds@nexus-reussite.com` | ELEVE | EDS Première Maths (alt) | `password123` |
| `eleve.stmg@nexus-reussite.com` | ELEVE | STMG Première | `password123` |
| `eleve.stmg.survival@nexus-reussite.com` | ELEVE | STMG Première + survivalMode | `password123` |
| `helios@nexus-reussite.com` | COACH | — | `password123` |
| `parent@example.com` | PARENT | — | `password123` |
| `admin@nexus-reussite.com` | ADMIN | — | e2e uniquement : `admin123` ; prod : `SEED_PASSWORD` obligatoire |
| `student46-1@nexus.local` | ELEVE | STMG Première (compte STMG de recette prod) | (cf. secrets manager) |

À enrichir au Lot E (Terminale EDS) et au Lot F (STMG Première complet).
