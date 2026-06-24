# Audit — Lot B : `/offres` server component extraction

**Date :** 2026-06-24
**Branche :** `fix/lot-b-offres-server`
**Baseline :** `0203d0f72` (main @ Lot A mergé)
**After :** `8ae2532a5` (refactor commit)

## Objectif

Passer `/offres` de composant client monolithique (`'use client'`) à server component
avec un seul îlot client (`OffersFiltersClient`) pour le filtre catégorie.

## Delta bundle (`npm run build`)

| Métrique | Avant (`0203d0f72`) | Après (`8ae2532a5`) | Delta |
|---|---|---|---|
| Page size (`/offres`) | 5,58 kB | 946 B | **−83 %** |
| First Load JS (`/offres`) | 149 kB | 143 kB | **−6 kB (−4 %)** |

## Architecture

| Fichier | Statut |
|---|---|
| `app/offres/page.tsx` | Server component (pas de `'use client'`) |
| `app/offres/_components/OffersFiltersClient.tsx` | Client island (`'use client'`) — filtre catégorie uniquement |
| `components/premium/ExamCard.tsx` | Server (retrait `'use client'`) |
| `components/premium/PassCard.tsx` | Server (retrait `'use client'`) |
| `components/premium/CarteNexusCard.tsx` | Server (retrait `'use client'`) |

## Preuve SSR (curl sans JS)

Sections rendues côté serveur : `section-annual`, `section-libre`, `section-plateforme`,
`section-intensifs`, `section-ponctuel`, `section-coaching`, `section-pass`, `section-carte`.

Ancres profondes (offres individuelles) : toutes présentes dans le HTML initial
(`term-excellence`, `cap-eaf`, `carte-nexus`, `pass-intensifs-term`, etc.).

Mega-bands : `mega-annee`, `mega-stages`, `mega-surmesure` — rendues avec `data-testid`.

## Gate complet

| Check | Résultat |
|---|---|
| Lint | 0 error (1 warning pré-existant `rbac.ts`) |
| Typecheck (`tsc --noEmit`) | 0 error |
| Unit tests (`jest --runInBand`) | 500/500 suites, 6 298 tests passed |
| Build (`next build`) | OK |
| E2E Playwright | **186/186 passed** |
| `audit:site-map` | 0 lien mort, 0 orpheline « à relier » |
| `check:docs-archive` | OK |
| `git diff --check` | 0 whitespace error |

## Lighthouse

Non exécuté (Chrome/Chromium non disponible hors Playwright sur cette machine).
Le delta bundle + preuve SSR curl constituent la preuve principale de l'objectif
(moins de JS client, page indexable sans JS).

## Garde anti-régression

Test unitaire ajouté (`__tests__/marketing/offres-server-guard.test.ts`) vérifiant que :
- `app/offres/page.tsx` ne contient pas `'use client'`
- `components/premium/ExamCard.tsx` ne contient pas `'use client'`
- `components/premium/PassCard.tsx` ne contient pas `'use client'`
- `components/premium/CarteNexusCard.tsx` ne contient pas `'use client'`
