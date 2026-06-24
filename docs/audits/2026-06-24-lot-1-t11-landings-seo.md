# Lot 1 T1.1 — Landings SEO

## Date

2026-06-24

## Contexte

Les quatre landings SEO déclarées dans le sitemap étaient trop courtes et peu reliées entre elles. Le dossier local `nexus-codex-handoff/` a servi de matière éditoriale et d’état cible, en l’adaptant au tree courant après le Lot 0 mergé.

## Problèmes observés

- Les pages `/candidat-libre-bac-francais`, `/preparation-bac-francais-tunis`, `/reussir-eaf` et `/grand-oral` reposaient sur un contenu court.
- Les metadata ne déclaraient pas de canonical.
- Le maillage interne entre les préparations était insuffisant.
- Le renderer `LandingNiche` ne rendait pas encore de sections longues ni de JSON-LD `FAQPage`.

## Décisions prises

- Créer une source de contenu typée dans `content/marketing/seo-landings.ts`.
- Garder les prix uniquement via `offerRefs` résolus par `lib/pricing.ts`.
- Corriger les repères session 2027 du corpus : Grand Oral coefficient 8 et épreuve anticipée de mathématiques coefficient 2.
- Formuler les éléments Cyclades/IFT avec prudence, car les dates et pièces varient selon la session.
- Ajouter un groupe navbar et un bloc footer « Préparations » depuis `content/marketing/preparation-links.ts`.
- Exclure `nexus-codex-handoff/` de TypeScript et de Git, car c’est une matière locale non source.

## Fichiers modifiés

- `content/marketing/seo-landings.ts`
- `content/marketing/preparation-links.ts`
- `components/marketing/LandingNiche.tsx`
- `app/candidat-libre-bac-francais/page.tsx`
- `app/preparation-bac-francais-tunis/page.tsx`
- `app/reussir-eaf/page.tsx`
- `app/grand-oral/page.tsx`
- `components/layout/CorporateNavbar.tsx`
- `components/layout/CorporateFooter.tsx`
- `__tests__/marketing/seo-landings-guard.test.ts`
- `.gitignore`
- `tsconfig.json`

## Tests exécutés

- `npm run test -- --runInBand __tests__/marketing/seo-landings-guard.test.ts`
- `npm run test -- --runInBand __tests__/lib/pricing-canonical-validator.test.ts __tests__/lib/pricing-display-coherence.test.ts __tests__/marketing/french-typography-guard.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`
- `npm run check:docs-archive`
- `git diff --check`
- `HOSTNAME=localhost PORT=3017 node .next/standalone/server.js`, puis vérification HTTP locale par `fetch`.

## Résultats

- Garde SEO T1.1 : 14 tests passés.
- Pricing/typographie ciblés : 54 tests passés.
- Jest complet : 491 suites passées, 1 skipped ; 6242 tests passés, 4 skipped.
- Build Next : 139 pages générées, assets standalone copiés.
- SSR local : les quatre routes répondent 200, contiennent leur canonical, un JSON-LD `FAQPage`, le CTA bilan et plus de 1000 mots extraits du HTML.

## Risques restants

- Les informations administratives IFT/Cyclades doivent rester vérifiées chaque session avant communication nominative à une famille.
- Le menu public contient désormais un groupe supplémentaire ; une passe visuelle mobile/desktop restera utile lors du lot marque/polish.

## Rollback

Revenir au commit précédent restaure les pages courtes et retire le contenu typé, la garde SEO T1.1 et le maillage « Préparations ».
