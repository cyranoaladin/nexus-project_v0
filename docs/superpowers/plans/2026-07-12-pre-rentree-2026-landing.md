# Pré-rentrée 2026 Landing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une landing Pré-rentrée 2026 statique, accessible, testée et reliée aux parcours bilan et WhatsApp sans base de données ni paiement.

**Architecture:** Un DTO serveur validé agrège le manifeste, les modules et le catalogue pricing via leurs loaders canoniques. Des fonctions pures pilotent le configurateur, le préremplissage et les analytics ; les composants clients se limitent aux interactions.

**Tech Stack:** Next.js App Router 15, React 18, TypeScript strict, Zod, Jest/Testing Library, Playwright, Tailwind CSS.

---

## Chunk 1: Contrat serveur et logique pure

### Task 1: Renforcer le DTO et le loader pricing

**Files:**
- Modify: `lib/pricing.ts`
- Modify: `lib/campaigns/pre-rentree-2026/schema.ts`
- Modify: `lib/campaigns/pre-rentree-2026/getters.ts`
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `content/pre-rentree-2026/modules.json`
- Test: `__tests__/campaigns/pre-rentree-2026.test.ts`
- Test: `__tests__/campaigns/pre-rentree-2026-landing-dto.test.ts`

- [ ] Écrire les tests qui exigent un getter pricing typé, un DTO complet sans `any`, les profils, la FAQ, le SEO, les conditions et tous les champs pédagogiques.
- [ ] Exécuter les tests et confirmer qu'ils échouent pour les champs/getters absents.
- [ ] Étendre les schémas Zod et les données contractuelles sans recopier les montants dans le manifeste.
- [ ] Résoudre les quatre packs avec `lib/pricing.ts` et refuser tout identifiant absent ou dupliqué.
- [ ] Exécuter les tests campagne/pricing et le typecheck.
- [ ] Commit: `fix(pre-rentree): harden landing campaign dto contract`.

### Task 2: Isoler la logique du configurateur

**Files:**
- Create: `lib/campaigns/pre-rentree-2026/configurator.ts`
- Test: `__tests__/campaigns/pre-rentree-2026-configurator.test.ts`

- [ ] Écrire les tests de niveaux, profils Première/Terminale, navigation Seconde, sélection 1–4 matières, pack exact, résumé, validation pédagogique, jours et horaires.
- [ ] Exécuter les tests et confirmer l'échec attendu par module absent.
- [ ] Implémenter les types et fonctions pures minimales, sans montant local ni fallback tarifaire.
- [ ] Exécuter les tests ciblés puis le typecheck.
- [ ] Commit avec le composant dans le chunk suivant pour garder un changement fonctionnel cohérent.

### Task 3: Parser strictement le préremplissage du bilan

**Files:**
- Create: `lib/campaigns/pre-rentree-2026/bilan-prefill.ts`
- Test: `__tests__/campaigns/pre-rentree-2026-bilan-prefill.test.ts`

- [ ] Écrire les tests des valeurs autorisées, limites, listes dédupliquées et rejet du prix/PII/texte libre.
- [ ] Exécuter les tests et confirmer l'échec attendu.
- [ ] Implémenter le parseur serveur et le builder client à partir des mêmes enums publics.
- [ ] Vérifier qu'aucun prix ne figure dans l'URL produite.

## Chunk 2: Landing et conversions

### Task 4: Recomposer la page et le configurateur

**Files:**
- Modify: `app/stages/pre-rentree-2026/page.tsx`
- Modify: `components/pre-rentree-2026/StageConfigurator.tsx`
- Modify: `components/pre-rentree-2026/PreRentreeHero.tsx`
- Create: `components/pre-rentree-2026/SelectionSummary.tsx`
- Create: `components/pre-rentree-2026/CampaignPageTracker.tsx`
- Test: `__tests__/components/pre-rentree-2026-landing.test.tsx`

- [ ] Écrire les tests composants pour le H1, statut, trois niveaux, profils, quatre matières, prix DTO, résumé, CTA bilan/WhatsApp et états incomplets.
- [ ] Confirmer les échecs liés aux IDs majuscules et comportements absents.
- [ ] Brancher le configurateur sur les fonctions pures et le DTO.
- [ ] Ajouter le résumé sticky desktop et repliable mobile avec `aria-live`.
- [ ] Construire le message WhatsApp complet via `buildWhatsAppUrl()` sans numéro local.
- [ ] Exécuter les tests composants, typecheck et lint ciblé.
- [ ] Commit: `feat(pre-rentree): complete configurator and conversion summary`.

### Task 5: Compléter planning, programmes, tarifs, méthode et FAQ

**Files:**
- Modify: `components/pre-rentree-2026/ScheduleSection.tsx`
- Modify: `components/pre-rentree-2026/ProgramsSection.tsx`
- Modify: `components/pre-rentree-2026/PricingSection.tsx`
- Modify: `components/pre-rentree-2026/NexusMethodSection.tsx`
- Modify: `components/pre-rentree-2026/PracticalInformation.tsx`
- Modify: `components/pre-rentree-2026/CampaignFAQ.tsx`
- Modify: `components/pre-rentree-2026/FinalCampaignCTA.tsx`
- Test: `__tests__/components/pre-rentree-2026-sections.test.tsx`

- [ ] Écrire les tests des deux vues planning, gestion clavier, filtre programme, contenu complet des séances, quatre packs, seize FAQ et conditions.
- [ ] Confirmer les échecs sur la vue semaine, les contenus tronqués et les constantes locales.
- [ ] Implémenter les sections à partir du DTO uniquement.
- [ ] Ajouter les événements de consultation sans PII.
- [ ] Exécuter tests, typecheck et lint ciblé.
- [ ] Commit: `feat(pre-rentree): complete schedule programs pricing and faq`.

### Task 6: Ajouter SEO, redirection et analytics typés

**Files:**
- Modify: `app/pre-rentree/page.tsx`
- Modify: `app/stages/pre-rentree-2026/page.tsx`
- Modify: `lib/analytics.ts`
- Test: `__tests__/campaigns/pre-rentree-2026-routing-seo.test.ts`
- Test: `__tests__/lib/analytics.test.ts`

- [ ] Écrire un test exigeant `permanentRedirect`, canonical unique, OG/Twitter complets, FAQPage et événements contractuels typés.
- [ ] Confirmer les échecs de redirection et événements absents.
- [ ] Implémenter les métadonnées depuis le DTO, le JSON-LD exact et les méthodes `track` autorisées.
- [ ] Exécuter les tests ciblés.

### Task 7: Préremplir le bilan gratuit

**Files:**
- Modify: `app/bilan-gratuit/page.tsx`
- Modify: `app/bilan-gratuit/BilanStrategiqueClient.tsx`
- Modify: `lib/bilan-gratuit-form.ts`
- Test: `__tests__/lib/bilan-gratuit-form.test.tsx`

- [ ] Écrire les tests de parsing serveur et préremplissage modifiable pour « Pré-rentrée 2026 ».
- [ ] Confirmer les échecs attendus.
- [ ] Passer le contexte validé au formulaire sans modifier l'API sauf nécessité démontrée.
- [ ] Vérifier que le serveur continue à résoudre le catalogue et qu'aucun prix URL n'est accepté.
- [ ] Commit: `feat(pre-rentree): prefill bilan and WhatsApp conversion flows`.

## Chunk 3: Accès marketing, E2E et preuves

### Task 8: Rendre la campagne accessible en un clic

**Files:**
- Modify: `components/layout/CorporateNavbar.tsx`
- Modify: `app/HomePageClient.tsx` or active homepage section source discovered by test
- Modify: `app/stages/_components/NexusStagesPage.tsx`
- Modify: `app/offres/page.tsx` or active offers client source discovered by test
- Create: `components/pre-rentree-2026/MobileCampaignBar.tsx`
- Test: relevant homepage/navbar/stages/offres tests

- [ ] Écrire les tests des quatre liens directs et de l'absence de l'ancien bloc 15 h.
- [ ] Confirmer les échecs pour home/stages/offres.
- [ ] Ajouter les liens avec un diff minimal et des données issues du DTO/getter serveur lorsque des valeurs de campagne sont affichées.
- [ ] Ajouter la barre mobile avec espace réservé et exclusion sur le formulaire campagne.
- [ ] Exécuter les tests publics ciblés.
- [ ] Commit: `feat(marketing): expose pre-rentree campaign across public pages`.

### Task 9: Ajouter les garde-fous structurels et E2E

**Files:**
- Create: `__tests__/campaigns/pre-rentree-2026-structure.test.ts`
- Create: `e2e/pre-rentree-2026.spec.ts`

- [ ] Écrire le garde-fou interdisant montants, numéro, imports JSON, anciennes formulations, `any`, `ts-ignore`, TODO/FIXME et directives de désactivation dans le périmètre actif.
- [ ] Écrire le scénario Playwright couvrant routes, quatre liens, trois niveaux, quatre matières, pack, bilan, WhatsApp, planning, programme, FAQ, clavier et mobile 390/320.
- [ ] Exécuter les tests, corriger uniquement les comportements réels et conserver les assertions fortes.
- [ ] Commit: `test(pre-rentree): cover landing accessibility mobile and conversion`.

### Task 10: Captures et audit final

**Files:**
- Modify: `docs/audits/2026-07-pre-rentree-commercial-catalog-audit.md` if evidence requires correction
- Create: `docs/audits/2026-07-pre-rentree-landing-implementation.md`

- [ ] Démarrer le build ou serveur local vérifié et produire les captures dans `/tmp/nexus-pre-rentree-2026-evidence`.
- [ ] Inspecter visuellement desktop, tablette, 390 px et 320 px, puis corriger tout chevauchement ou overflow.
- [ ] Exécuter npm ci, tests campagne/pricing/composants/E2E, typecheck, lint, build et tous les audits demandés avec codes de sortie conservés.
- [ ] Vérifier l'absence de changement Prisma, migration, API V2, paiement, disponibilité inventée, montant/numéro dans les composants, secrets, symlinks et opérations Git.
- [ ] Documenter commandes, résultats, captures et risques restants.
- [ ] Commit: `docs(pre-rentree): record landing implementation and visual evidence`.

