# Plan d’action go-live Nexus Réussite

## Phase 0 — Baseline et cadrage

- Objectif : figer l'état réel local, les risques, les gates et les prochains lots.
- Fichiers concernés : `rapport_audit_2_07_2026.md`, `AGENTS.md`, `docs/go-live/*`, `docs/security/API_GUARD_INVENTORY.md`, `docs/architecture/SITE_MAP.md`.
- Actions : lire l'audit racine, croiser avec le code, exécuter les commandes, créer backlog P0/P1/P2 et release gates.
- Risques : basculer en refonte prématurée sans preuve ; confondre audit et état courant.
- Tests attendus : typecheck, lint, unit, build, audit API guards, site map, hardcoded, archive, bundle.
- Critères d'acceptation : documents Lot 0 créés, verdict clair, commandes tracées.
- Dépendances : aucune.
- Statut initial : **réalisé Lot 0**.

## Phase 1 — Sécurité API / IDOR / rate limiting

- Objectif : rendre les API sensibles compatibles bêta élargie et go-live large.
- Fichiers concernés : `app/api/**/route.ts`, `lib/rbac.ts`, `lib/guards.ts`, `lib/access/*`, `lib/rate-limit/*`, `docs/security/API_GUARD_INVENTORY.md`.
- Actions : auditer les 44 P0 et 42 P1, ajouter ownership explicite, tests IDOR, Zod manquant, rate limit sur routes publiques et coûteuses, preuve Redis/Upstash.
- Risques : accès croisé parent/élève/coach, lecture de documents ou factures hors périmètre, spam formulaire, contournement par multi-instance.
- Tests attendus : unit IDOR par route dynamique, tests 401/403/404, tests 429 distribués, `node scripts/security/audit-api-guards.mjs`.
- Critères d'acceptation : 0 P0 ouvert, routes dynamiques propriétaires couvertes, rate limiting distribué prouvé hors mémoire.
- Dépendances : décisions de rôle et ownership.
- Statut initial : **P0 ouvert**.

## Phase 2 — Pricing, offres et conversion

- Objectif : garantir cohérence commerciale 2026/2027, source canonique et tunnels sans friction.
- Fichiers concernés : `data/pricing.canonical.json`, `lib/pricing.ts`, `lib/pricing-client.ts`, `app/offres/page.tsx`, `app/stages/page.tsx`, `app/bilan-gratuit/*`, `app/HomePageClient.tsx`, `content/marketing/*`.
- Actions : vérifier tous les montants affichés, supprimer reliquats archives activables, aligner stages août 2026, clarifier candidat libre, vérifier CTA, consentement analytics.
- Risques : prix contradictoires, promesse non défendable, campagne vers tunnel trop agressif, perte de confiance.
- Tests attendus : `npm run check:no-hardcoded`, tests marketing existants, smoke mobile Playwright.
- Critères d'acceptation : aucune page publique critique avec montant hors getter, promesse engagement de moyens, CTA principal clair.
- Dépendances : validation humaine des offres.
- Statut initial : **P1 ouvert, P0 si campagne immédiate sans consentement/tracking**.

## Phase 3 — Paiement, facturation, entitlements

- Objectif : rendre la chaîne d'achat fiable, traçable et réconciliable.
- Fichiers concernés : `app/api/payments/*`, `app/api/invoices/*`, `app/api/admin/invoices/*`, `lib/invoice/*`, `lib/entitlement/*`, `prisma/schema.prisma`.
- Actions : décider ClicToPay off/on, finaliser webhook, aligner `PRODUCT_REGISTRY` et pricing, garantir `InvoiceItem.productCode`, retraiter les cas sans beneficiary, clarifier projections legacy.
- Risques : paiement validé sans droit, droit accordé sans paiement, facture non générée, crédit doublé.
- Tests attendus : tests transaction paiement, webhook signature, idempotence, accès PDF parent/admin, entitlement registry vs pricing.
- Critères d'acceptation : virement manuel robuste, ClicToPay soit désactivé proprement soit complet, entitlements source de vérité.
- Dépendances : pricing et catalogue produit figés.
- Statut initial : **P0 ouvert pour ClicToPay/entitlements**.

## Phase 4 — Dashboards par rôle

- Objectif : stabiliser parent, élève, coach, assistante, admin sur droits et données utiles.
- Fichiers concernés : `app/dashboard/**`, `app/api/parent/**`, `app/api/student/**`, `app/api/coach/**`, `app/api/assistante/**`, `lib/access/*`, `lib/rbac/*`.
- Actions : smoke par rôle, vérifier navigation, données masquées, actions critiques, états vides, mobile.
- Risques : fuite inter-rôle, confusion opérationnelle, actions staff non journalisées.
- Tests attendus : E2E login par rôle, tests API 403/404, smoke dashboards.
- Critères d'acceptation : chaque rôle voit uniquement son périmètre et peut accomplir ses workflows clés.
- Dépendances : Phase 1 sécurité API.
- Statut initial : **P1 ouvert, P0 sur routes classées critiques**.

## Phase 5 — IA, ARIA, RAG, NPC

- Objectif : garantir une IA utile, bornée, traçable et non survendue.
- Fichiers concernés : `app/api/aria/*`, `lib/aria.ts`, `lib/rag-client.ts`, `docs/RAG_ARCHITECTURE.md`, `app/api/npc/*`, `lib/npc/*`, `services/npc-worker/*`.
- Actions : figer backend RAG canonique, aligner docs/code, vérifier feature flags ARIA, clarifier mode NPC `stub/live/off`, tester uploads et ownership.
- Risques : réponses IA non maîtrisées, NPC stub présenté comme live, fuite de copies ou bilans, dépendance externe non monitorée.
- Tests attendus : ARIA feature/ownership, RAG health, NPC upload/file access, worker mode, prompts sans PII inutile.
- Critères d'acceptation : IA présentée comme complément, mode runtime explicite, RAG backend unique vérifié.
- Dépendances : env RAG/LLM et sécurité documents.
- Statut initial : **P0/P1 ouvert**.

## Phase 6 — RGPD, mineurs, logs, documents

- Objectif : réduire l'exposition des données mineurs, documents, bilans et logs.
- Fichiers concernés : `app/politique-confidentialite/page.tsx`, `app/conditions-generales/page.tsx`, `app/api/documents/*`, `app/api/student/documents/*`, `app/api/npc/files/*`, `lib/logger*`, `lib/utils/serialize-error.ts`.
- Actions : registre traitements, consentement, minimisation formulaire, durée conservation, suppression/export, logs safe, stockage privé, antivirus éventuel.
- Risques : non-conformité, exposition de PII, conservation excessive, fichiers sensibles servis sans contrôle.
- Tests attendus : no-leak tests, route document IDOR, logs redaction, consentement analytics.
- Critères d'acceptation : documents privés uniquement via contrôle d'accès, logs sans PII excessive, consentement explicite.
- Dépendances : Phase 1 et décisions légales humaines.
- Statut initial : **P0 ouvert**.

## Phase 7 — Infra, backup, monitoring, rollback

- Objectif : rendre la production opérable et restaurable.
- Fichiers concernés : `Dockerfile.prod`, `docker-compose.prod.yml`, `next.config.mjs`, `.github/workflows/ci.yml`, `app/api/health/route.ts`, `app/api/internal/health/route.ts`.
- Actions : confirmer PM2 ou Docker, ports, Nginx, SSL, healthchecks, logs, sauvegarde DB/storage, restore drill, monitoring alertes.
- Risques : production non restaurable, panne silencieuse, port exposé, dépendance env manquante.
- Tests attendus : healthchecks, restore backup, curl pages critiques, monitoring synthetic.
- Critères d'acceptation : rollback documenté, backup restauré au moins une fois, alerting opérationnel.
- Dépendances : accès production et décision infra.
- Statut initial : **P0 ouvert**.

## Phase 8 — QA finale, smoke tests, release gates

- Objectif : décider factuellement de la release.
- Fichiers concernés : `tests/e2e/**`, `playwright.config.*`, `docs/go-live/03_RELEASE_GATES.md`, CI.
- Actions : smoke public, mobile, accessibilité, SEO, parcours leads, parcours paiement manuel, dashboards par rôle, non-régression API P0.
- Risques : release basée sur build uniquement, régression mobile, pages campagnes cassées.
- Tests attendus : `npm run typecheck`, `npm run lint`, `npm run test:unit -- --runInBand`, `npm run build`, `npx playwright test`, curls production.
- Critères d'acceptation : gate atteint, P0 fermé, rapport de release signé.
- Dépendances : Phases 1 à 7.
- Statut initial : **à faire après lots correctifs**.
