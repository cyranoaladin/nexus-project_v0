# Lot A — Orphelines et hygiène navigation

## Date

2026-06-24

## Contexte

Les décisions Shark de clôture imposent de retirer la page publique `/corrige_dnb_maths_2026`, d’assumer `/ressources` comme hub public, de conserver `/notre-centre`, de classer les routes techniques en `noindex`, de documenter le loss-leader Carte Nexus et de maintenir l’audit architecture sans lien mort ni orpheline à relier.

## Décisions prises

- `/corrige_dnb_maths_2026` supprimée du routeur applicatif et du sitemap, avec redirect HTTP 301 vers `/ressources`.
- `/ressources` reliée depuis la navigation et conservée au sitemap comme hub public.
- `/notre-centre` conservée, avec adresse pédagogique lue depuis `LEGAL.addresses.pedagogique`.
- Routes techniques ou élève hors sitemap passées en `noindex, nofollow`.
- Carte Nexus documentée dans le canonical comme loss-leader assumé, sans changement de prix.
- `ROADMAP.md` classé sous `docs/roadmaps/RAG_PLATFORM_ROADMAP.md`.
- Mapping hash dashboard élève corrigé pour `#resources` et `#aria`.

## Fichiers modifiés

- Routes et navigation : `app/sitemap.ts`, `next.config.mjs`, `components/layout/CorporateNavbar.tsx`, `app/notre-centre/page.tsx`.
- Noindex : `app/access-required/page.tsx`, `app/bilan-gratuit/assessment/layout.tsx`, `app/bilan-pallier2-maths/confirmation/layout.tsx`, `app/lamis/page.tsx`, `app/programme/maths-1ere-stmg/page.tsx`, `app/programme/maths-terminale/page.tsx`.
- Canonical et gardes : `data/pricing.canonical.json`, `lib/pricing.ts`, `__tests__/marketing/lot-a-closure-decisions.test.ts`, `__tests__/marketing/public-addressing-guard.test.ts`.
- Audit architecture : `scripts/audit/site-map.mjs`, `docs/architecture/SITE_MAP.md`, `docs/architecture/SITE_GRAPH.mmd`, `docs/architecture/SSOT_MAP.md`.

## Tests exécutés

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`
- `npm run test:e2e`
- `npm run audit:site-map`
- `npm run check:docs-archive`
- `git diff --check`

## Résultats

- Jest : 500 suites passées, 1 suite skip ; 6298 tests passés, 4 skips.
- Playwright : 186 tests passés.
- Build : 138 pages statiques générées, standalone produit.
- Audit architecture : 287 routes, 430 arêtes, 0 lien mort, 13 orphelines publiques classées, aucune `a relier` ou `non classee`.
- Preuve HTTP locale : `/corrige_dnb_maths_2026` répond 301 vers `/ressources`; `/ressources` et `/notre-centre` répondent 200; les routes techniques ciblées exposent `noindex, nofollow`.

## Risques restants

- Les lots restants restent inchangés : extraction server de `/offres`, puis migration charte unique `lux-*`.
- Les avertissements lint historiques restent sous le seuil configuré et n’ont pas été traités dans ce lot.

## Rollback

- Restaurer la route supprimée depuis le commit précédent si nécessaire.
- Retirer le redirect `/corrige_dnb_maths_2026` de `next.config.mjs`.
- Régénérer `npm run audit:site-map` après rollback.
