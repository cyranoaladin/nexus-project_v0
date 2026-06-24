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
- La revue PR #48 a relevé des canonical absolus dans le contenu, des types de contenu dupliqués, des `offerRefs` filtrés sans garde et une garde SEO trop liée à la forme du code.

## Décisions prises

- Créer une source de contenu typée dans `content/marketing/seo-landings.ts`.
- Garder les prix uniquement via `offerRefs` résolus par `lib/pricing.ts`.
- Corriger les repères session 2027 du corpus : Grand Oral coefficient 8 et épreuve anticipée de mathématiques coefficient 2.
- Formuler les éléments Cyclades/IFT avec prudence, car les dates et pièces varient selon la session.
- Ajouter un groupe navbar et un bloc footer « Préparations » depuis `content/marketing/preparation-links.ts`.
- Exclure `nexus-codex-handoff/` de TypeScript et de Git, car c’est une matière locale non source.
- Laisser `metadataBase` dans `app/layout.tsx` résoudre les canonical relatifs, et ne plus recopier le domaine public dans `content/`.
- Faire de `LandingNiche` la source des types `OfferRef`, `NicheSection` et `RelatedLink`.
- Rattacher les adresses pédagogiques à `LEGAL.addresses.pedagogique` et les claims Cyclades/ARIA/bacs blancs au catalogue canonique.

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
- `NEXTAUTH_URL=https://nexusreussite.academy npm run build`
- `npm run check:docs-archive`
- `git diff --check`
- `NEXTAUTH_URL=https://nexusreussite.academy HOSTNAME=localhost PORT=3017 node .next/standalone/server.js`, puis vérification HTTP locale par `fetch`.
- Script Playwright temporaire `/tmp/playwright-t11-responsive.js` sur desktop 1440 et mobile 390.

## Résultats

- Garde SEO T1.1 : 28 tests passés.
- Pricing/typographie ciblés : 54 tests passés.
- Jest complet : 491 suites passées, 1 skipped ; 6256 tests passés, 4 skipped.
- Build Next : 139 pages générées, assets standalone copiés.
- SSR local : les quatre routes répondent 200, contiennent leur canonical résolu `https://nexusreussite.academy/...`, un JSON-LD `FAQPage`, le CTA bilan et un H1.
- Grep demandé : aucune occurrence de `nexusreussite.academy` dans `content/` ni dans `__tests__/marketing/seo-landings-guard.test.ts`.
- Grep demandé : une seule déclaration par type `OfferRef`, `NicheSection`, `RelatedLink`, toutes dans `components/marketing/LandingNiche.tsx`.
- Responsive local : desktop 1440 et mobile 390 sans overflow horizontal, navbar/footer présents, liens du cluster présents sur les quatre landings.

## Risques restants

- Les informations administratives IFT/Cyclades doivent rester vérifiées chaque session avant communication nominative à une famille.
- La CI GitHub Actions reste à vérifier côté PR #48 : si elle est encore bloquée par la facturation, la PR doit rester draft et nécessiter une revue humaine explicite avant merge.
- Le dossier `nexus-codex-handoff/` et les exclusions associées restent à nettoyer après consommation complète du handoff en fin T1.2/T1.3.

## Rollback

Revenir au commit précédent restaure les pages courtes et retire le contenu typé, la garde SEO T1.1 et le maillage « Préparations ».
