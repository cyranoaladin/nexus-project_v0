# Parent Modal Wiring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monter et prouver les deux modales parent restantes : demande de credits et details d'abonnement.

**Architecture:** Reutiliser les composants existants sur `/dashboard/parent/abonnements`, car cette page possede deja l'enfant selectionne et les donnees d'abonnement. Ne pas creer de nouveau flux de paiement ; la demande de credits reste une demande validee par l'assistante.

**Tech Stack:** Next.js 15 App Router, TypeScript, Radix Dialog, Playwright auth e2e, Prisma seed e2e.

---

## Chunk 1: Tests Rouges

**Files:**
- Modify: `e2e/auth/dialog-all-roles-proof.spec.ts`

- [ ] **Step 1: Ajouter deux preuves parent**

Ajouter :
- `parent: abonnements credit-purchase dialog`
- `parent: abonnements invoice-details dialog`

Chaque test se connecte en parent, ouvre `/dashboard/parent/abonnements`, clique le vrai trigger et appelle `assertDialogCharte` puis `assertDialogCloses`.

- [ ] **Step 2: Verifier le rouge**

Run:

```bash
CI=1 BASE_URL=http://localhost:3002 npx playwright test --config=playwright.auth.config.ts e2e/auth/dialog-all-roles-proof.spec.ts --reporter=line
```

Expected: les deux nouveaux tests echouent car les triggers n'existent pas encore.

## Chunk 2: Cablage Applicatif

**Files:**
- Modify: `app/dashboard/parent/abonnements/page.tsx`
- Modify: `app/dashboard/parent/credit-purchase-dialog.tsx`
- Modify: `app/dashboard/parent/invoice-details-dialog.tsx`

- [ ] **Step 3: Exposer les donnees d'abonnement au type Child**

Ajouter les champs requis : `subscriptionStartDate`, `subscriptionEndDate`, `monthlyPrice`.

- [ ] **Step 4: Monter les deux modales**

Dans la carte "Abonnement actuel", ajouter les triggers :
- demande de credits pour l'enfant courant ;
- details d'abonnement si un abonnement existe.

- [ ] **Step 5: Ajuster les libelles produit**

Remplacer les formulations trompeuses :
- "Acheter des Credits" -> "Demander des credits" ;
- "facturation automatique" -> message prudent sur validation/suivi administratif.

## Chunk 3: Verification Et Livraison

**Files:**
- Modify: `scripts/gate-all.sh`
- Modify: `DETTE.md`
- Create or modify audit doc under `docs/audits/`

- [ ] **Step 6: Relever AUTH_MIN**

Passer `AUTH_MIN=35`.

- [ ] **Step 7: Verifier ciblage et gate complet**

Run targeted, puis :

```bash
./scripts/gate-all.sh
```

Expected totals: Jest 6215, public 184, auth 35, total 6434, `EXIT=0`.

- [ ] **Step 8: Commit, push, deploy**

Push dans l'ordre demande :

```bash
git push origin feat/design-conversion:main
git push origin feat/design-conversion
```

Puis deploy prod car le code applicatif change.
