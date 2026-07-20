# Pré-rentrée 2026 Commercial Contract and Week-One Kit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le contrat commercial canonique puis un kit de campagne semaine 1 réellement exploitable et vérifiable.

**Architecture:** Une source commerciale sans montants est compilée avec `lib/pricing.ts` et un registre de preuves. Un renderer déterministe transforme une source de campagne complète en exports versionnés hors du site public.

**Tech Stack:** TypeScript, Zod, Jest, JSON, Python, Pillow, WeasyPrint, FFmpeg.

---

## Chunk 1: Contrat commercial

### Task 1: Écrire les tests du contrat

**Files:**
- Create: `__tests__/campaigns/pre-rentree-2026-commercial-contract.test.ts`

- [ ] Tester la dérivation des prix et acomptes depuis le pricing canonique.
- [ ] Tester l'exception 3e, les capacités 5/6 et les matières autorisées.
- [ ] Tester l'absence publique de SNT, manuels et remise annuelle.
- [ ] Exécuter le test et constater un échec dû à l'implémentation absente.

### Task 2: Implémenter la façade

**Files:**
- Create: `content/pre-rentree-2026/commercial-contract.fr.json`
- Create: `content/pre-rentree-2026/proofs.registry.json`
- Create: `lib/campaigns/pre-rentree-2026/commercial-contract.ts`
- Modify: `data/pricing.canonical.json`
- Modify: `lib/pricing.ts`

- [ ] Ajouter la métadonnée d'exception sans changer le plancher global.
- [ ] Ajouter les sources éditoriales fermées et versionnées.
- [ ] Compiler prix, acompte, durée et capacité via les getters pricing.
- [ ] Filtrer les offres et avantages non publiables.
- [ ] Exécuter les tests ciblés, le typecheck et le contrôle de diff.
- [ ] Committer et pousser `fix(pre-rentree): establish canonical commercial publication contract`.

## Chunk 2: Kit semaine 1

### Task 3: Écrire les tests de complétude

**Files:**
- Create: `__tests__/campaigns/pre-rentree-2026-week-one-kit.test.ts`
- Create: `scripts/pre-rentree/tests/test_week_one_assets.py`

- [ ] Tester les contenus complets, CTA, UTM et preuves.
- [ ] Tester les inventaires attendus et les dimensions.
- [ ] Exécuter les tests et constater l'échec dû aux sources/exports absents.

### Task 4: Produire les sources et exports

**Files:**
- Create: `content/pre-rentree-2026/week-one-campaign.fr.json`
- Create: `scripts/pre-rentree/render_week_one_kit.py`
- Create: `assets/campaigns/pre-rentree-2026/week-one/**`
- Modify: `package.json`

- [ ] Rédiger les textes, carrousel, Reel, Stories et calendrier de sept jours.
- [ ] Produire SVG/PNG/WebP/PDF/SRT/MP4/CSV et manifeste SHA-256.
- [ ] Exécuter les tests TypeScript/Python et le renderer deux fois pour la reproductibilité.
- [ ] Rasteriser les PDF et inspecter chaque famille d'assets.
- [ ] Exécuter typecheck, garde-fous, `git diff --check` et hygiène du dépôt.
- [ ] Committer et pousser `feat(pre-rentree): deliver complete week-one campaign kit`.

## Chunk 3: PR et rapport

### Task 5: Mettre à jour la PR

- [ ] Ajouter l'inventaire des livrables et les résultats de vérification à la PR 71.
- [ ] Vérifier les workflows du nouveau HEAD sans merger ni déployer.
- [ ] Rapporter les décisions restantes et conserver le verdict `BLOCKED` ou `REVIEW` si une validation humaine manque.
