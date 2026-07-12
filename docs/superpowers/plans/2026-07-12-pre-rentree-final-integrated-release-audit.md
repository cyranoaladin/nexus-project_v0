# Pré-rentrée 2026 Final Integrated Release Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un SHA RC unique, sans fuite interne ni contradiction publique, puis construire et déployer exactement ce SHA sur la preview isolée.

**Architecture:** Ajouter des gates d’audit déterministes autour des sources canoniques, du DTO, des composants et de l’artefact Next.js. Les corrections éventuelles restent dans les sources de vérité et les règles de compatibilité, jamais dans des rustines JSX. Les preuves commerciales, juridiques, pédagogiques et opérationnelles sont consolidées dans deux rapports de release.

**Tech Stack:** Next.js 15.5.18, React, TypeScript, Jest, Zod, Playwright, PostgreSQL 15 éphémère, Docker Compose preview, Nginx Basic Auth/TLS.

---

## Chunk 1: Gates de release et cartographie

### Task 1: Gate des fuites internes et du hardcoding public

**Files:**
- Create: `scripts/pre-rentree/final-public-release-audit.mjs`
- Create: `__tests__/campaigns/pre-rentree-2026-final-public-release.test.ts`
- Modify if required: campaign source/getter/component identified by the failing gate

- [ ] Écrire un test source qui exige le script d’audit, les familles de tokens interdites et les scans source/artefact/rendu.
- [ ] Exécuter le test et constater l’échec dû au gate absent.
- [ ] Implémenter le scanner avec classification serveur/test/document/frontend/client/analytics.
- [ ] Exécuter le scanner sur les sources et corriger uniquement les occurrences exposées.
- [ ] Construire l’application et exécuter le scanner sur `.next/server`, `.next/static`, HTML, RSC et chunks client.
- [ ] Vérifier l’absence de valeurs canoniques recopiées dans les composants et l’absence d’import JSON direct.

### Task 2: Gate offres, services et CTA

**Files:**
- Create: `__tests__/campaigns/pre-rentree-2026-final-commercial-consistency.test.ts`
- Modify if required: `data/campaigns/pre-rentree-2026.json`
- Modify if required: `components/pre-rentree-2026/*.tsx`
- Modify if required: `lib/campaigns/pre-rentree-2026/*.ts`

- [ ] Écrire les assertions des quatre packs depuis le pricing canonique.
- [ ] Écrire la matrice des services publics et interdire ARIA/coaching/rattrapage/espace parent non contractuels.
- [ ] Cartographier tous les CTA et interdire « Réserver » sur les surfaces actives.
- [ ] Exécuter le test et enregistrer tout écart réel.
- [ ] Corriger seulement les copies publiques ou sources canoniques démontrées incohérentes.
- [ ] Rejouer les tests campagne, pricing, bilan, WhatsApp et CTA.

## Chunk 2: Compatibilité et parcours parent

### Task 3: Matrice profil × matière

**Files:**
- Create if absent: `lib/campaigns/pre-rentree-2026/profile-compatibility.ts`
- Create: `__tests__/campaigns/pre-rentree-2026-profile-compatibility.test.ts`
- Modify if required: `lib/campaigns/pre-rentree-2026/configurator.ts`
- Modify if required: `components/pre-rentree-2026/StageConfigurator.tsx`

- [ ] Définir dans le test les cas COMPATIBLE, COMPATIBLE_WITH_DIFFERENTIATION, REQUIRES_PEDAGOGICAL_REVIEW et INCOMPATIBLE.
- [ ] Exécuter le test et constater les incompatibilités acceptées silencieusement.
- [ ] Implémenter la fonction pure minimale de classification.
- [ ] Bloquer les incompatibilités certaines et afficher les validations requises sans créer de cohorte.
- [ ] Rejouer la matrice combinatoire et les 45 combinaisons de matières.

### Task 4: Programmes, planning et tunnel complet

**Files:**
- Modify tests only unless contradiction: `__tests__/campaigns/pre-rentree-2026-structure.test.ts`
- Modify tests only unless contradiction: `__tests__/campaigns/pre-rentree-2026-staffing.test.ts`
- Create: `e2e/pre-rentree-2026-final-parent-journey.spec.ts`

- [ ] Étendre les contrats des 12 modules/60 séances/prérequis et des trois rôles/deux salles.
- [ ] Écrire le parcours homepage → landing → configuration → résumé → bilan/WhatsApp.
- [ ] Vérifier sélection, retour arrière, paramètres sans prix/PII et analytics.
- [ ] Corriger uniquement une contradiction de source démontrée.

## Chunk 3: Qualification et preuves

### Task 5: Juridique, rentabilité et rapports

**Files:**
- Create: `docs/reports/2026-07-pre-rentree-public-claims-matrix.md`
- Create: `docs/reports/2026-07-pre-rentree-final-integrated-release-audit.md`
- Reference: `docs/legal/pre-rentree-2026-commercial-terms-gap-analysis.md`
- Reference: `docs/business/pre-rentree-2026-profitability-model.md`

- [ ] Classer chaque engagement public avec preuve, responsable, charge et statut.
- [ ] Comparer landing/FAQ/informations/bilan/CGV et consigner le texte exact des écarts juridiques.
- [ ] Calculer les CA et plafonds de coûts directs à 3/4/5 élèves sans inventer de coûts.
- [ ] Définir les gates propriétaire : ressources, rentabilité, juridique et publication.

### Task 6: Qualification locale et PostgreSQL 15

**Files:**
- Modify tests/scripts only if a gate est réellement incomplet

- [ ] Exécuter `npm ci`, typecheck, lint et tous les tests ciblés sous Node 20.20.0.
- [ ] Exécuter les quatre RBAC conditionnels sur PostgreSQL 15 éphémère et relever le nombre réel de skips.
- [ ] Exécuter `PERF_TESTS=1 ./scripts/gate-all.sh` sans serveur concurrent.
- [ ] Exécuter build, standalone, smoke, liens, sitemap, sécurité, secrets et `git diff --check`.
- [ ] Créer au maximum trois commits applicatifs/tests puis le commit documentaire final.

### Task 7: SHA unique, preview et preuves distantes

**Files:**
- No secret or production configuration committed
- Update: `docs/reports/2026-07-pre-rentree-final-integrated-release-audit.md`

- [ ] Pousser la branche sans force et vérifier SHA local = distant.
- [ ] Construire l’image Docker depuis le HEAD exact, documents inclus.
- [ ] Déployer uniquement l’app preview, conserver DB/MailHog/Nginx/production.
- [ ] Vérifier label image = HEAD exact et app healthy.
- [ ] Exécuter HTTP/E2E distants, scanner les réponses et les logs.
- [ ] Générer et inspecter toutes les captures demandées hors Git.
- [ ] Vérifier la production en lecture seule et finaliser les rapports sans modifier le SHA déployé.
