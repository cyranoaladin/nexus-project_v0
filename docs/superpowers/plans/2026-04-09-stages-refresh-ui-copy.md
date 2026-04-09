# Stages Refresh UI Copy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehausser la landing active `/stages` avec une meilleure hiérarchie visuelle, un copywriting plus net et des icônes Lucide cohérentes.

**Architecture:** La route et les données métier restent en place. Le travail se concentre sur les composants de présentation de `app/stages/_components` et sur la normalisation iconographique via `lucide-react`.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Jest, Testing Library, lucide-react.

---

## Chunk 1: Verrouiller le rendu attendu

### Task 1: Ajouter des tests ciblés sur la nouvelle hiérarchie

**Files:**
- Modify: `__tests__/stages/printemps2026-page.test.tsx`

- [ ] **Step 1: Écrire le test rouge**
- [ ] **Step 2: Vérifier qu'il échoue**
- [ ] **Step 3: Implémenter le rendu minimal nécessaire**
- [ ] **Step 4: Vérifier qu'il passe**

### Task 2: Ajouter un test ciblé sur les icônes non-emoji dans les cartes

**Files:**
- Modify: `__tests__/stages/printemps2026-page.test.tsx`

- [ ] **Step 1: Écrire le test rouge**
- [ ] **Step 2: Vérifier qu'il échoue**
- [ ] **Step 3: Remplacer le rendu emoji par Lucide**
- [ ] **Step 4: Vérifier qu'il passe**

## Chunk 2: Refondre la narration et les composants

### Task 3: Recomposer le hero et le sticky header

**Files:**
- Modify: `app/stages/_components/StagesHeader.tsx`
- Modify: `app/stages/_components/StagesHero.tsx`
- Modify: `app/stages/_components/CountdownChip.tsx`
- Modify: `app/stages/_components/CTAButton.tsx`

- [ ] **Step 1: Rehausser les labels, CTA et bénéfices**
- [ ] **Step 2: Ajouter des icônes Lucide cohérentes**
- [ ] **Step 3: Vérifier le rendu**

### Task 4: Clarifier le bloc urgence et comparaison

**Files:**
- Modify: `app/stages/_components/UrgencyTimeline.tsx`
- Modify: `app/stages/_components/MarketComparison.tsx`

- [ ] **Step 1: Réduire le bruit visuel**
- [ ] **Step 2: Remplacer les emojis par Lucide**
- [ ] **Step 3: Renforcer le message ROI**

### Task 5: Refaire les cartes d'académies

**Files:**
- Modify: `app/stages/_components/AcademiesSection.tsx`
- Modify: `app/stages/_components/AcademyCard.tsx`
- Modify: `app/stages/_data/packs.ts`

- [ ] **Step 1: Introduire un mapping d'icônes Lucide**
- [ ] **Step 2: Réorganiser la card autour de la décision**
- [ ] **Step 3: Vérifier les filtres et CTA**

### Task 6: Harmoniser les sections de bas de page

**Files:**
- Modify: `app/stages/_components/GrandOralSection.tsx`
- Modify: `app/stages/_components/PricingTable.tsx`
- Modify: `app/stages/_components/SocialProof.tsx`
- Modify: `app/stages/_components/FAQSection.tsx`
- Modify: `app/stages/_components/FinalCTA.tsx`

- [ ] **Step 1: Uniformiser les badges et titres**
- [ ] **Step 2: Renforcer la lisibilité**
- [ ] **Step 3: Vérifier la cohérence iconographique**

## Chunk 3: Validation

### Task 7: Vérification finale

**Files:**
- Verify: `app/stages/page.tsx`
- Verify: `app/stages/_components/*`
- Verify: `__tests__/stages/printemps2026-page.test.tsx`

- [ ] **Step 1: Lancer les tests ciblés**
Run: `npx jest --config jest.config.js __tests__/stages/printemps2026-page.test.tsx __tests__/stages/stages-layout-metadata.test.ts --runInBand`

- [ ] **Step 2: Lancer le lint**
Run: `npm run lint`

- [ ] **Step 3: Lancer le build**
Run: `npm run build`

- [ ] **Step 4: Résumer les changements avec preuves**
