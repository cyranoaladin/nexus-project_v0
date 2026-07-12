# Homepage Pré-rentrée Spotlight Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre la campagne Pré-rentrée 2026 au premier plan de la homepage avec un spotlight premium, accessible et alimenté exclusivement par le DTO canonique.

**Architecture:** Un getter serveur dérive un DTO homepage minimal. Un composant marketing client-safe rend le spotlight et ses analytics typées. La homepage conserve son hero et son routeur, mais place le spotlight entre la navbar et le hero.

**Tech Stack:** Next.js 15.5.18, React 18, TypeScript, Tailwind Nexus, Jest/Testing Library, Playwright, Axe.

---

## Chunk 1: contrats et données

### Task 1: Contrats rouges du spotlight

**Files:**
- Create: `__tests__/components/pre-rentree-homepage-spotlight.test.tsx`
- Create: `__tests__/campaigns/pre-rentree-2026-homepage-spotlight.test.ts`
- Modify: `__tests__/homepage/landing-invariants.test.ts`

- [ ] Écrire les attentes de contenu, ordre, routes, DTO et interdictions structurelles.
- [ ] Exécuter les trois suites et vérifier l'échec dû au composant/getter absents.
- [ ] Conserver la sortie rouge comme preuve TDD.

### Task 2: DTO homepage minimal

**Files:**
- Modify: `lib/campaigns/pre-rentree-2026/presentation.ts`
- Modify: `lib/campaigns/pre-rentree-2026/getters.ts`
- Modify: `app/page.tsx`

- [ ] Ajouter les formatters de cartouche date et de liste française.
- [ ] Dériver statut, période, classes, matières, capacité, volume, lieu et routes.
- [ ] Vérifier que les tests DTO passent sans import JSON côté composant.

## Chunk 2: rendu et navigation

### Task 3: Spotlight premium

**Files:**
- Create: `components/marketing/PreRentreeCampaignSpotlight.tsx`
- Modify: `app/HomePageClient.tsx`
- Modify: `__tests__/marketing/public-lux-charte-guard.test.ts`

- [ ] Rendre les trois zones desktop et la composition mobile.
- [ ] Placer le composant avant `HeroSection` et supprimer l'ancienne carte pâle.
- [ ] Séparer visuellement le routeur permanent sans modifier sa logique.
- [ ] Exécuter les tests de composant et homepage jusqu'au vert.

### Task 4: Navbar prioritaire

**Files:**
- Modify: `components/layout/CorporateNavbar.tsx`
- Modify: `__tests__/components/corporate-navbar.test.tsx`

- [ ] Tester d'abord les liens desktop/mobile et le maintien de Connexion.
- [ ] Ajouter l'icône calendrier et les styles Nexus.
- [ ] Remplacer l'action mobile fermée par la campagne, garder Connexion dans le menu.
- [ ] Vérifier le rendu à 320 px et les tests au vert.

## Chunk 3: analytics, E2E et livraison

### Task 5: Analytics sans PII

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-analytics.test.ts`

- [ ] Écrire les contrats rouges des quatre événements et propriétés autorisées.
- [ ] Implémenter les fonctions typées et l'impression unique.
- [ ] Vérifier les tests analytics et structurels.

### Task 6: E2E et captures

**Files:**
- Modify: `e2e/pages-public-homepage.spec.ts`

- [ ] Couvrir ordre des sections, premier viewport, navbar, clavier, Axe et analytics.
- [ ] Couvrir desktop, tablette, 390, 320 et zoom 200 %.
- [ ] Générer neuf captures dans `/tmp/nexus-pre-rentree-2026-homepage-spotlight`.
- [ ] Inspecter toutes les preuves et corriger uniquement les défauts observés.

### Task 7: qualification, commits et preview

**Files:**
- Create: `docs/reports/2026-07-pre-rentree-homepage-spotlight-preview.md`

- [ ] Exécuter Node 20.20.0, typecheck, lint, suites ciblées et gate global.
- [ ] Exécuter build, standalone, smokes, audits, sécurité et contrôle secrets.
- [ ] Créer au plus quatre commits atomiques puis pousser sans force.
- [ ] Construire le SHA applicatif exact et remplacer uniquement la stack preview.
- [ ] Rejouer les E2E/captures distants et vérifier la production en lecture seule.
- [ ] Documenter résultats, rollback et validation propriétaire.
