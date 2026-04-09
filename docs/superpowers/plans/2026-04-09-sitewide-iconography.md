# Sitewide Iconography Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les emojis d'interface visibles par des icônes Lucide cohérentes sur les surfaces produit Nexus Réussite.

**Architecture:** Introduire un registre central d'icônes sémantiques, l'utiliser pour les composants pilotés par données, puis nettoyer les pages et composants live où des emojis restent rendus dans l'UI. Les emails transactionnels visibles utilisateur sont harmonisés à la fin.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Jest, Playwright

---

## Chunk 1: Centraliser les mappings

### Task 1: Créer le registre central d'icônes

**Files:**
- Create: `lib/ui-icons.tsx`

- [ ] **Step 1: Définir les mappings sémantiques**

Créer un registre couvrant :
- matières
- badges
- états/alertes
- CTA fréquents
- helpers de fallback

- [ ] **Step 2: Exporter des helpers de rendu**

Prévoir :
- récupération par clé
- récupération depuis un ancien glyph emoji
- fallback visuel neutre

## Chunk 2: Corriger les surfaces data-driven

### Task 2: Badges et listes pilotées par données

**Files:**
- Modify: `lib/badges.ts`
- Modify: `components/ui/parent/badge-display.tsx`
- Modify: `components/dashboard/parent/children-list.tsx`

- [ ] **Step 1: Remplacer le rendu brut des emojis par le registre central**
- [ ] **Step 2: Conserver les données métier, ne changer que le rendu si possible**
- [ ] **Step 3: Vérifier les fallbacks**

### Task 3: Matières et contenus structurés

**Files:**
- Modify: `app/plateforme-aria/page.tsx`
- Modify: `components/stages/RequiredMaterials.tsx`
- Modify: `components/stages/TierSelector.tsx`
- Modify: `components/stages/AcademyGrid.tsx`
- Modify: `components/stages/SubjectTierTable.tsx`

- [ ] **Step 1: Remplacer les champs `icon: string` rendus par des icônes Lucide**
- [ ] **Step 2: Nettoyer les CTA et labels qui embarquent des emojis**
- [ ] **Step 3: Vérifier la hiérarchie visuelle**

## Chunk 3: Corriger les pages marketing et stages

### Task 4: Pages les plus exposées

**Files:**
- Modify: `app/offres/page.tsx`
- Modify: `app/plateforme-aria/page.tsx`
- Modify: `app/stages/_components/*.tsx`
- Modify: `components/sections/homepage/*.tsx`

- [ ] **Step 1: Retirer les emojis décoratifs des badges, CTA et cartes**
- [ ] **Step 2: Remplacer par des Lucide cohérents**
- [ ] **Step 3: Garder le ton premium et lisible**

## Chunk 4: Corriger dashboards et surfaces d'assistance

### Task 5: Dashboards visibles utilisateur

**Files:**
- Modify: `app/dashboard/**/page.tsx`
- Modify: `components/dashboard/**/*.tsx`
- Modify: `components/ui/**/*.tsx` (surfaces live uniquement)

- [ ] **Step 1: Nettoyer les icônes emoji visibles**
- [ ] **Step 2: Uniformiser tailles/couleurs des icônes Lucide**
- [ ] **Step 3: Vérifier qu'aucune surface critique ne mélange emoji + Lucide**

## Chunk 5: Emails visibles utilisateur

### Task 6: Harmoniser les templates transactionnels principaux

**Files:**
- Modify: `lib/email.ts`
- Modify: `lib/email-service.ts`
- Modify: `lib/email/templates.ts`

- [ ] **Step 1: Retirer les emojis décoratifs non essentiels**
- [ ] **Step 2: Remplacer par formulation textuelle sobre quand HTML email ne supporte pas une vraie icône**
- [ ] **Step 3: Préserver la lisibilité mobile**

## Chunk 6: Vérification et livraison

### Task 7: Vérifier, commit, push, déployer

**Files:**
- Review only: repo status and changed files

- [ ] **Step 1: Lancer des greps ciblés anti-emoji sur les surfaces traitées**
- [ ] **Step 2: Exécuter `npm run lint`**
- [ ] **Step 3: Exécuter `npm run build`**
- [ ] **Step 4: Exécuter les tests ciblés nécessaires**
- [ ] **Step 5: Committer les changements**
- [ ] **Step 6: Pousser la branche puis `main`**
- [ ] **Step 7: Déployer en production et vérifier les pages clés**
