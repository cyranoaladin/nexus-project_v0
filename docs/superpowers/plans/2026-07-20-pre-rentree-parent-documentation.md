# Pré-rentrée 2026 Parent Documentation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les quatorze documents parent demandés en sources HTML/CSS éditables, PDF lisibles et exports visuels contrôlés, exclusivement à partir du contrat commercial compilé.

**Architecture:** Une source éditoriale sans montants référence les offres par `offerId`. Le renderer charge le snapshot du contrat commercial, injecte les prix et acomptes canoniques, masque les décisions non closes, puis produit de façon déterministe les HTML, PDF, captures PNG et un manifeste SHA-256 hors des pages publiques.

**Tech Stack:** JSON, TypeScript/Jest, Python, Jinja-style HTML generation, CSS paged media, WeasyPrint, PyMuPDF, Pillow, pytest.

---

## Chunk 1: Contrat et garde-fous documentaires

### Task 1: Définir les attentes avant l'implémentation

**Files:**
- Create: `__tests__/campaigns/pre-rentree-2026-parent-documents.test.ts`
- Create: `scripts/pre-rentree/tests/test_parent_document_kit.py`

- [x] **Step 1: Écrire les tests TypeScript en échec**

Tester les quatorze identifiants de documents, les textes complets, les `offerIds`, CTA, `proofIds`, l'absence de montants dans la source et l'absence des avantages masqués.

- [x] **Step 2: Exécuter le test TypeScript et constater RED**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/campaigns/pre-rentree-2026-parent-documents.test.ts`

Expected: FAIL car `content/pre-rentree-2026/parent-documents.fr.json` n'existe pas.

- [x] **Step 3: Écrire les tests Python en échec**

Tester les quatorze HTML/PDF, les pages rasterisées, les dimensions, polices incorporées, pages non blanches, absence de coupure/débordement, liens WhatsApp et manifeste SHA-256.

- [x] **Step 4: Exécuter le test Python et constater RED**

Run: `python -m pytest scripts/pre-rentree/tests/test_parent_document_kit.py -q`

Expected: FAIL car le renderer parent n'existe pas.

## Chunk 2: Sources et renderer déterministe

### Task 2: Rédiger les documents parent

**Files:**
- Create: `content/pre-rentree-2026/parent-documents.fr.json`
- Create: `scripts/pre-rentree/render_parent_document_kit.py`
- Create: `scripts/pre-rentree/templates/parent-document.css`
- Modify: `package.json`

- [x] **Step 1: Ajouter la source éditoriale sans prix**

Inclure brochure, guide parent, fiches 3e/Seconde/Première/Terminale, comparatif Fondations/Premium, inclusions/options/exclusions, justification tarifaire, FAQ, inscription, conditions d'acompte, accompagnements annuels et passerelle stage vers annuel.

- [x] **Step 2: Implémenter l'injection canonique minimale**

Compiler les offres via `.artifacts/pre-rentree-2026/commercial-contract.snapshot.json`; ne jamais lire ni recopier un montant depuis la source éditoriale.

- [x] **Step 3: Implémenter les sorties finales**

Produire HTML/CSS, PDF A4, PNG de chaque page, planches de contrôle et `manifest.json` avec dimensions, poids et SHA-256 dans `assets/campaigns/pre-rentree-2026/parent-documents/`.

- [x] **Step 4: Maintenir le filtrage conservateur**

Ne pas publier manuels, remise annuelle, modalité de paiement non validée, conditions d'annulation/remboursement non approuvées, bilan ou suivi parent non prouvé.

## Chunk 3: Validation et livraison du LOT 4

### Task 3: Passer GREEN et inspecter les rendus

**Files:**
- Create: `assets/campaigns/pre-rentree-2026/parent-documents/**`

- [x] **Step 1: Générer deux fois et comparer les manifestes**

Run: `npm run pre-rentree:parent-documents`

Expected: quatorze HTML, quatorze PDF, captures complètes et hashes identiques hors horodatage inexistant.

- [x] **Step 2: Exécuter les tests ciblés**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/campaigns/pre-rentree-2026-parent-documents.test.ts`

Run: `python -m pytest scripts/pre-rentree/tests/test_parent_document_kit.py -q`

Expected: PASS.

- [x] **Step 3: Inspecter toutes les planches de contrôle**

Vérifier typographie, marges, contraste, pagination, liens, absence de page blanche, texte tronqué ou vocabulaire interne.

- [x] **Step 4: Exécuter les garde-fous transverses**

Run: `npm run pre-rentree:test:ts && npm run pre-rentree:test:py && npm run typecheck && git diff --check`

Expected: PASS.

- [x] **Step 5: Committer et pousser le lot**

Run: `git commit -m "feat(pre-rentree): deliver parent conversion documentation"`

Run: `git push origin integration/canonical-fusion-20260720`

Expected: nouveau HEAD présent sur la branche distante, sans merge ni déploiement.
