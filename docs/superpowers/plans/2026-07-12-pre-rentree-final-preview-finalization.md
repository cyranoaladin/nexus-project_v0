# Pré-rentrée 2026 Final Preview Finalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une release candidate où les niveaux sont explicitement des classes d'entrée, les ressources pédagogiques sont verrouillées et Next.js 15.5.18 est qualifié.

**Architecture:** Conserver les codes internes existants et corriger les sources contractuelles, puis laisser les DTO propager les labels publics. Séparer le commit métier/tests du commit de dépendance et du rapport de preuve.

**Tech Stack:** Next.js 15.5.x, React, TypeScript, Zod, Jest, Testing Library, Playwright.

---

### Task 1: Baseline et tests rouges

**Files:**
- Modify: `__tests__/campaigns/pre-rentree-2026-entry-level.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-configurator.test.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-analytics.test.ts`

- [x] Exécuter la baseline Node, Next, audit, tests ciblés, typecheck, lint et build.
- [x] Écrire les invariants publics, pédagogiques, analytics et ressources.
- [x] Vérifier l'échec attendu avant toute correction de production.

### Task 2: Contrat classe d'entrée et pédagogie

**Files:**
- Modify: `data/campaigns/pre-rentree-2026.json`
- Modify: `content/pre-rentree-2026/modules.json`
- Modify: `lib/campaigns/pre-rentree-2026/schema.ts`
- Modify: `lib/campaigns/pre-rentree-2026/configurator.ts`
- Modify: `lib/analytics.ts`
- Modify: `components/pre-rentree-2026/StageConfigurator.tsx`
- Modify: `components/pre-rentree-2026/ScheduleSection.tsx`
- Modify: `components/pre-rentree-2026/ProgramsSection.tsx`
- Modify: `app/bilan-gratuit/page.tsx`
- Modify: `app/bilan-gratuit/BilanStrategiqueClient.tsx`

- [x] Exposer « Entrée en… » depuis le manifeste et documenter `level` comme code interne de classe d'entrée.
- [x] Remplacer les propriétés analytics de campagne par les noms autorisés, dont `entry_level`.
- [x] Corriger bilan, résumé et WhatsApp à partir du DTO.
- [x] Corriger les douze titres/prérequis de transition dans la source pédagogique.
- [x] Déclarer les trois rôles non nominatifs et vérifier les deux salles.
- [x] Rejouer les tests ciblés jusqu'au vert.
- [x] Créer les commits métier et tests atomiques.

### Task 3: Next.js 15.5.18

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] Installer uniquement `next@15.5.18` en version exacte.
- [x] Vérifier une seule version installée et l'absence de changement direct inattendu.
- [x] Rejouer audit runtime, tests ciblés, typecheck, lint et build.
- [x] Créer le commit dépendance atomique.

### Task 4: Qualification et preuves finales

**Files:**
- Modify: `e2e/pre-rentree-2026.spec.ts`
- Create: `docs/reports/2026-07-pre-rentree-final-preview-readiness.md`
- Modify: `docs/reports/2026-07-pre-rentree-landing-release-candidate-review.md`
- Modify: `docs/specs/pre-rentree-2026-analytics-contract.md`
- Modify: `docs/specs/pre-rentree-2026-landing-dto-contract.md`

- [x] Exécuter `npm ci` sous le runtime Node canonique.
- [x] Rejouer typecheck, lint, 6 628+ tests, tests ciblés et anti-hardcoding.
- [x] Construire et lancer le standalone, exécuter les smokes et E2E.
- [x] Régénérer les captures dans `/tmp/nexus-pre-rentree-2026-final-preview`.
- [x] Inspecter les captures et documenter audit avant/après, risques et rollback.
- [x] Créer le commit documentaire final et vérifier l'état Git propre.
