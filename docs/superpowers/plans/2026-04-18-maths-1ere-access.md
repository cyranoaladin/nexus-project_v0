# Maths 1ere Access Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restreindre `/programme/maths-1ere` aux roles staff/parent et aux seuls eleves dont `Student.grade` vaut `Première`.

**Architecture:** Le controle reste local a la page server component. La session donne le role; seul le role `ELEVE` declenche une lecture Prisma du profil `Student`. La redirection suit le dashboard natif de l'utilisateur afin d'eviter un ecran d'erreur inutile.

**Tech Stack:** Next.js App Router, NextAuth, Prisma, Jest.

---

## Chunk 1: Guard Coverage

### Task 1: Ajouter le test de garde de page

**Files:**
- Create: `__tests__/app/programme.maths-1ere.page.test.tsx`
- Reference: `__tests__/api/programme.maths-1ere.progress.route.test.ts`

- [ ] Ecrire le test pour les cas non connecte, eleve `Première`, eleve hors `Première`, parent/admin/assistante/coach.
- [ ] Mock `@/auth`, `@/lib/prisma`, `next/navigation` et `MathsRevisionClient`.
- [ ] Executer la suite cible et verifier l'echec.

### Task 2: Implementer le garde serveur

**Files:**
- Modify: `app/programme/maths-1ere/page.tsx`

- [ ] Ajouter la logique de redirection par role.
- [ ] Ajouter la lecture `Student.grade` uniquement pour le role `ELEVE`.
- [ ] Garder la redirection signin existante intacte.

### Task 3: Verifier

- [ ] Run: `npm test -- --runInBand __tests__/app/programme.maths-1ere.page.test.tsx`
- [ ] Run: `npm test -- --runInBand __tests__/api/programme.maths-1ere.progress.route.test.ts`
