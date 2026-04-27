# CLEANUP REPORT — Lot A baseline

**Date** : 2026-04-27
**Branche** : `chore/cleanup-and-baseline-2026-04-27`
**Base** : `main` @ `6871cf5a`
**Scope** : audit baseline (ts-prune, depcheck, unimported), tri des candidats §4.2 du prompt finalisation Go-Live, déplacement PDFs officiels §4.1, stub `lib/programme/official-pdfs.ts`.

---

## 1. Outils — baseline brute

| Outil | Sortie | Lignes | Statut |
|---|---|---|---|
| `npx ts-prune -p tsconfig.json` | `/tmp/cleanup-audit/ts-prune.txt` | 1 180 (871 hors `used in module`) | ✅ |
| `npx depcheck` | `/tmp/cleanup-audit/depcheck.txt` | 23 | ✅ |
| `npx unimported` | `/tmp/cleanup-audit/unimported.txt` | 800 fichiers, 67 deps | ✅ |

### 1.1 ts-prune — distribution des exports non utilisés

| Dossier | Exports non utilisés |
|---|---|
| `.next/types/` | 375 (généré, **ignorer**) |
| `lib/assessments/` | 130 |
| `lib/invoice/` | 62 |
| `components/dashboard/` | 50 |
| `lib/validation/` | 48 |
| `components/sections/` | 28 |
| `lib/entitlement/` | 17 |
| `e2e/helpers/` | 17 |
| `components/ui/` | 17 |
| `app/stages/` | 16 |
| `app/dashboard/` | 16 |
| `lib/theme/` | 15 |
| autres | < 15 |

**Décision Lot A** : enregistrement baseline uniquement. La purge ciblée des exports morts dans `lib/assessments`, `lib/invoice`, `components/dashboard`, `components/ui` est trop volumineuse pour Lot A et doit faire l'objet d'un audit individuel par sous-domaine (intégrable au Lot J ou à un Lot dédié `chore/dead-code-purge`).

### 1.2 depcheck — packages

**Unused dependencies déclarées** (à valider — certaines sont des faux positifs probables) :

```
@auth/prisma-adapter       # vraisemblablement utilisé via auth.ts (config)
@heroicons/react           # à confirmer (présence dans composants)
@radix-ui/react-dropdown-menu, react-progress, react-separator
@supabase/supabase-js      # FAUX POSITIF — utilisé dans app/programme/maths-1ere/lib/supabase.ts
chokidar, commander, pg, pino-http, tar, uuid, winston, winston-daily-rotate-file
```

**Unused devDependencies** : `@tailwindcss/postcss` (à valider — peut-être référencé via config Tailwind).

**Missing dependencies (déclarées implicitement)** :

| Package | Source | Action recommandée (hors Lot A) |
|---|---|---|
| `dotenv` | `jest.setup.js` | ajouter à `package.json` ou retirer l'import si inutile |
| `pdf-parse` | `tools/programmes/extract_programme_text.ts` | ajouter à `package.json` |
| `axe-core` | `scripts/audit-contrast.mjs` | ajouter ou retirer le script |
| `@jest/globals` | `lib/assessments/__tests__/scoring-factory.test.ts` | ajouter à `package.json` |
| `.prisma` | `__mocks__/@prisma/client.js` | faux positif (chemin de mock) |

**Décision Lot A** : enregistrement baseline. Aucune dépendance retirée à ce stade — risque de casser un import indirect non détecté.

### 1.3 unimported — fichiers non importés

**800 fichiers** détectés comme jamais importés. Cela inclut majoritairement :

- scripts dans `scripts/` (CLI manuels — comportement normal)
- outils dans `tools/` (CLI compile/segment — comportement normal)
- fichiers `prisma/seed*.ts` et variantes (entry points runtime)
- pages App Router (Next.js les charge dynamiquement, faux positifs)
- types (`types/automatismes.ts`, `types/enums.ts`)

**Décision Lot A** : pas de purge généralisée. Les vrais orphelins seront extraits manuellement à partir de cette liste lors d'un Lot dédié.

---

## 2. Candidats §4.2 du prompt — décisions

### 2.1 Déjà absents (cleanup antérieur)

| Candidat | État |
|---|---|
| `middleware-auth.ts` | absent ✅ |
| `prisma/schema.prisma.backup.20260427_093951` | absent ✅ |
| `prod-tree-2026-04-18.txt` | absent ✅ |
| `arborescence.txt`, `arborescence_complete.txt` | absent ✅ |
| `parent.json`, `student.json` (racine) | absent ✅ |

### 2.2 Conservés (référence productive trouvée)

| Candidat | Raison |
|---|---|
| `app/maths-1ere/page.tsx` | alias `redirect('/programme/maths-1ere')` actif — règle §4.2 conservation |
| `start-production.sh` | référencé par `scripts/mega-e2e-validation.ts:706` |

### 2.3 À supprimer (zéro référence productive)

| Candidat | Vérification grep |
|---|---|
| `bilan_diagnostic_maths_terminale.jsx` (115 KB, racine) | 0 ref |
| `production_tree.txt` | 0 ref productive (ne se référence que lui-même + ancien snapshot) |
| `nexus_prod_tree_20260425.txt` | 0 ref productive |
| `task.md` (racine) | 0 ref productive (1 mention dans `production_tree.txt` qui est lui-même supprimé) |
| `prisma/seed-zakaria.js` | doublon de `seed-zakaria.ts` |
| `prisma/seed-zakaria-minimal.js` | variante orpheline |
| `prisma/seed-zakaria-prod.js` | doublon de `seed-zakaria-prod.ts` |
| `prisma/seed-zakaria-prod.ts` | redondant avec `seed-zakaria.ts` typé fort |

**Canonique conservé** : `prisma/seed-zakaria.ts` (8 870 octets, le plus complet et typé). Documenté dans `docs/seed-data.md` (à créer à la suite).

### 2.4 À déplacer

| Candidat | Destination | Raison |
|---|---|---|
| `automatismes_EDS_Premiere/*.pdf` (6 fichiers) | `programmes/automatismes-eds-premiere/` (renommage kebab-case ASCII) | §4.1 prompt — sortir de la racine, indexer via `lib/programme/official-pdfs.ts` |
| `fix-db-infra.sh` | `scripts/legacy/` | 0 ref — prudence (scripts manuels potentiels) |
| `push.sh` | `scripts/legacy/` | 0 ref |
| `start_server.sh` | `scripts/legacy/` | 0 ref |
| `test-with-middleware-swap.sh` | `scripts/legacy/` | 0 ref |
| `verify_all.sh` | `scripts/legacy/` | 0 ref |

Note : `start-production.sh` reste à la racine (référence active).

### 2.5 Renommage PDFs (kebab-case ASCII)

| Avant | Après |
|---|---|
| `annexe-automatismes-valuables-lors-de-l-preuve-anticip-e-de-math-matiques-pour-l-ann-e-scolaire-2025-2026-au-titre-de-la-session-2027-des-baccalaur-ats-g-n-ral-et-technologique-440631.pdf` | `bo-annexe-automatismes-eam-2025-2026-session-2027.pdf` |
| `declic1S_2026_sujets.pdf` | `declic-1s-2026-sujets.pdf` |
| `Programme de mathématiques de première générale-248133.pdf` | `programme-officiel-maths-premiere-generale.pdf` |
| `QCM 2025_3adlane°-.pdf` | `qcm-2025-adlane.pdf` |
| `sujet-specialite-1pdf-112050.pdf` | `sujet-specialite-1.pdf` |
| `sujet-specialite-2pdf-112053.pdf` | `sujet-specialite-2.pdf` |

---

## 3. Spec `e2e/` — non traité dans Lot A

Le prompt §4.2 mentionne plusieurs spec E2E redondants (`parent-dashboard-{api-test,audit,debug,manual,plain}`, `test-all-{dashboard-pages,pages}`, `test-{bilan-banner,dashboard-interactions,mobile,real-login}`, etc.). Le tri de ces fichiers nécessite une matrice de couverture E2E pour ne pas perdre de scénario. Cette tâche est explicitement assignée au **Lot I — Tests E2E exhaustifs et nettoyage spec**. **Aucune action E2E dans Lot A.**

---

## 4. Doublons fonctionnels §4.4 — non traité dans Lot A

| Sujet | Statut |
|---|---|
| Diagnostics Maths (`lib/diagnostics/...` vs `lib/diagnostic/maths-terminale/...`) | À auditer en Lot dédié |
| Email service (`lib/email-service.ts`, `lib/email.ts`, `lib/email/mailer.ts`) | À auditer |
| Bilan generator (`lib/bilan-generator.ts`, `lib/bilan/generator.ts`) | À auditer |
| Scoring (5+ fichiers) | Cible : `docs/SCORING_ARCHITECTURE.md` |

Ces audits nécessitent une analyse fine des responsabilités et sont mis dans un backlog séparé pour ne pas alourdir Lot A.

---

## 5. Actions Lot A exécutées

Voir commits sur la branche `chore/cleanup-and-baseline-2026-04-27` :

1. `chore(cleanup): add baseline audit report` — ce document
2. `chore(cleanup): move official PDFs to programmes/ with kebab-case names`
3. `chore(cleanup): remove orphan root files (snapshots, bilan jsx, task.md)`
4. `chore(cleanup): consolidate seed-zakaria scripts to single typed source`
5. `chore(cleanup): relocate orphan shell scripts to scripts/legacy/`
6. `feat(programme): add lib/programme/official-pdfs.ts stub + test`
7. `docs(seed): add docs/seed-data.md inventory`

---

## 6. Definition of Done — Lot A

| Critère | Cible | État |
|---|---|---|
| `tsc --noEmit` | 0 erreur | à vérifier |
| `npm run lint` | 0 nouveau warning vs baseline | à vérifier |
| `npm test` | 100% pass | à vérifier |
| `npm run build` | success | à vérifier |
| `__tests__/lib/single-source-of-truth.test.ts` | vert | à vérifier |
| Diff lisible | une commit par sujet | en cours |

Les vérifications finales sont effectuées avant le checkpoint Lot A.
