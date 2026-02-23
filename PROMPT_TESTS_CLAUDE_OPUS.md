# PROMPT — Proposition Exhaustive de Tests pour Nexus Réussite

> Ce prompt est destiné à Claude Opus 4. Objectif : proposer TOUS les tests possibles et envisageables pour garantir 0 erreur, 0 bug, 0 dysfonctionnement et un projet fonctionnel à 100%.

---

## CONTEXTE DU PROJET

**Nexus Réussite** est une plateforme SaaS de pilotage éducatif (Next.js 15 App Router, TypeScript strict, PostgreSQL + pgvector, Prisma ORM, NextAuth v5, Ollama LLM, FastAPI RAG Ingestor).

- **Production** : https://nexusreussite.academy
- **74 pages** · **81 API routes** · **5 rôles** (ADMIN, ASSISTANTE, COACH, PARENT, ELEVE) · **38 modèles Prisma** · **20 enums**
- **Tests existants** : 219 fichiers Jest (unit + API) + 30 fichiers E2E Playwright
- **Stack tests** : Jest 29 (jsdom + node) · Playwright 1.58 · Coverage thresholds configurés

---

## FICHIERS DE RÉFÉRENCE À LIRE EN PRIORITÉ

Lis ces fichiers dans cet ordre pour comprendre le projet à 100% :

### Tier 1 — Vue complète (OBLIGATOIRE)
1. `arborescence_complete.txt` — Structure complète du projet (1479 fichiers)
2. `README.md` — Source de vérité : stack, architecture, 81 API, 38 modèles, workflows, RBAC, entitlements, paiements
3. `NAVIGATION_MAP.md` — Carte de navigation : 74 pages, dashboards, sidebar, CTAs, redirections, matrice d'accès, feature gating

### Tier 2 — Fonctionnalités détaillées
4. `docs/AUDIT_WORKFLOWS_DASHBOARDS.md` — Audit de chaque workflow par rôle et chaque dashboard
5. `docs/API_CONVENTIONS.md` — Conventions API, méthodes, validation Zod, error handling
6. `docs/FINAL_AUDIT_REPORT.md` — Audit complet (bugs, manques, recommandations)
7. `docs/30_AUTHENTIFICATION.md` — Flux auth (signin, activate, reset-password)
8. `docs/31_RBAC_MATRICE.md` — Matrice RBAC par rôle × ressource
9. `docs/32_ENTITLEMENTS_ET_ABONNEMENTS.md` — Feature gating, entitlements
10. `docs/33_SECURITE_ET_CONFORMITE.md` — Sécurité, CSRF, rate limiting
11. `docs/20_GUIDE_NAVIGATION.md` — Guide navigation par rôle
12. `docs/21_GUIDE_DASHBOARDS.md` — Guide dashboards
13. `docs/22_GUIDE_QUESTIONNAIRES_ET_BILANS.md` — Questionnaires et bilans
14. `docs/40_LLM_RAG_PIPELINE.md` — Pipeline LLM/RAG
15. `SESSION_BOOKING_LOGIC.md` — Logique réservation sessions
16. `JITSI_IMPLEMENTATION.md` — Visioconférence

### Tier 3 — Tests existants
17. `docs/TEST_STRATEGY.md` — Stratégie de tests actuelle
18. `docs/TEST_SCRIPTS.md` — Scripts de tests
19. `docs/qa_auth_workflows_report.md` — Rapport QA auth
20. `__tests__/README.md` — Structure tests existants
21. `__tests__/ISOLATION_STRATEGY.md` — Stratégie d'isolation
22. `e2e/fixtures/README.md` — Fixtures E2E

### Tier 4 — Spécifications fonctionnelles
23. `feuille_route/Specifications-Fonctionnelles-par-Role.md` — Specs par rôle
24. `feuille_route/Logique Metier_Business Model.md` — Logique métier
25. `feuille_route/Profils_Equipe_Gamification.md` — Profils, gamification
26. `docs/BILAN_PALLIER2_MATHS_COMPLET.md` — Spec complète bilan diagnostique
27. `docs/DATA_INVARIANTS.md` — Invariants de données (contraintes DB)
28. `docs/DESIGN_SYSTEM.md` — Design system
29. `docs/MIDDLEWARE.md` — Middleware (auth, rate limit, logger)
30. `docs/SECURITY.md` — Sécurité détaillée

---

## TESTS EXISTANTS (219 fichiers Jest + 30 E2E)

### Tests unitaires/API existants (`__tests__/`)

**API Routes (56 fichiers)** :
- admin: dashboard, analytics, activities, subscriptions, test-email, users
- aria: chat, conversations, feedback
- assessments: rbac, submit
- assistant: coaches, coaches/[id], credit-requests, dashboard, students.credits, subscription-requests, subscriptions
- auth: nextauth, route, workflows
- bilan-gratuit, bilan-pallier2-maths
- coach: dashboard, session-report
- coaches: availability, available
- contact, health (×2)
- messages: conversations, send
- notifications
- parent: children, credit-request, dashboard, subscription-requests, subscriptions
- payments: validate
- reservation
- sessions: book (×3), cancel, video
- student: badges, credits, dashboard, resources, sessions
- subscriptions: aria-addon, change
- rbac: admin, matrix
- error-logging

**Composants UI (34 fichiers)** :
- corporate-navbar, diagnostic-form, floating-nav, HomePage, navigation-item, offres-page
- parent: badge-display, financial-history, progress-chart
- sections: cta, hero, offers-preview, pillars
- trajectoire-timeline
- ui: accordion, alert, avatar, badge, breadcrumb, button, card, checkbox, dialog, error-boundary, input, label, modal, popover, radio-group, scroll-area, select, skeleton, switch, table, tabs, textarea, toast, tooltip

**Lib/Business Logic (100+ fichiers)** :
- access: credits-guard, features (×2), guard, rules
- analytics (×3), api-errors (×3), api-helpers
- aria (×4): test, coverage, intelligence, streaming
- assessments: core/config, core/types
- auth (×2): test, security
- badges, bilan-gratuit-form, bilan-renderer
- cleanup-sw, constants
- core: assessment-status, canonical-domains, normalize, raw-sql-monitor
- credits (×3): test, extra, refund-idempotency
- cron-jobs, db-raw, diagnostic-form
- diagnostics (×8): api-integration, comprehensive-engine, delta-features, llm-robustness, prompt-context, safe-log-definitions, scoring-chapters, scoring-regression.snapshot, token-security
- email (×4): mailer, service (×2), test
- entitlement (×4): activation-modes, engine-contract, product-registry, subscription-features.contract
- env-validation, form-validation-simple
- generators: bilan-generator-llm-mode
- guards, invoice (×11): access-token (×2), events-sanitize, no-leak, pdf-clamp, rbac, receipt-preconditions, send-throttle, sequence, token-revocation, transitions
- jitsi, logger, middleware (×4)
- next-step-engine, nexus-index (×2)
- payments, prisma, programmes (×2), rag-client, rate-limit
- rbac (×2), scopes, score-diagnostic (×2), scoring-engine
- security-headers, session-booking, signed-token
- telegram/client, theme (×3)
- trajectory (×2), translations, utils
- validation (×8): common, index, payments, session-report, sessions, extra, test, users
- web3-guard

**Concurrency (3)** : credit-debit-idempotency, double-booking, payment-idempotency
**Database (2)** : schema, aria-pgvector, assessment-pipeline
**Security (1)** : jwt-escalation
**Transactions (1)** : payment-validation-rollback
**Stages (2)** : fevrier2026-cta-count, fevrier2026-data
**Middleware (3)** : pino-logger, rate-limit-integration, security-headers

### Tests E2E existants (`e2e/`, 30 fichiers)
- aria.chat, auth-and-booking, auth.workflows
- bilan-gratuit-flow, booking.credits
- diagnostic-flows, entitlements.gating
- forms-validation.contract, generate-state
- link-checker, marketing-navigation
- navigation-public.contract, offres-quiz
- parent-dashboard (×4): spec, api-test, debug, manual
- payments.invoice.documents, premium-home
- programme/maths-1ere
- qa-auth-workflows, rbac.dashboards.contract
- redirections.contract, security.advanced
- stages-fevrier2026, stages.workflow
- static-pages, student-aria, student-dashboard, student-journey

---

## TA MISSION

Tu dois proposer une **liste EXHAUSTIVE de TOUS les tests** à écrire ou compléter pour atteindre **0 erreur, 0 bug, 0 dysfonctionnement** et un projet **fonctionnel à 100%**.

Pour chaque test proposé, fournis :
1. **Nom du fichier** (chemin complet)
2. **Type** (unit / integration / e2e / contract / stress / security / accessibility / visual / performance)
3. **Description** de ce qui est testé
4. **Cas de test** détaillés (happy path + edge cases + error cases)
5. **Priorité** (P0 critique / P1 important / P2 nice-to-have)
6. **Statut** : NOUVEAU ou COMPLÉTER (si le fichier existe déjà mais manque de cas)

---

## CATÉGORIES DE TESTS À COUVRIR (AUCUN ANGLE MORT)

### 1. TESTS UNITAIRES — Logique Métier Pure

#### 1.1 Moteurs de calcul
- **Scoring Engine** (`lib/scoring-engine.ts`) : tous les cas de scoring stages (scores parfaits, scores nuls, scores mixtes, questions NSP, pondérations W1/W2/W3, edge cases 0 réponses)
- **Scoring V2 Diagnostic** (`lib/diagnostics/score-diagnostic.ts`) : TrustScore calcul, RiskIndex (60/40 split), détection incohérences (4 règles), priorités (TopPriorities, QuickWins, HighRisk), couverture programme
- **SSN** (`lib/core/ssn/computeSSN.ts`) : normalisation, percentiles, edge cases (0 assessments, 1 assessment, 100 assessments)
- **UAI** (`lib/core/uai/computeUAI.ts`) : calcul index unifié, pondérations
- **ML Predict** (`lib/core/ml/predictSSN.ts`) : Ridge regression, stabilité trend, prédiction avec données insuffisantes
- **Cohort Stats** (`lib/core/statistics/`) : normalisation, percentiles, distribution
- **Nexus Index** (`lib/nexus-index.ts`) : score composite, tous les composants, edge cases
- **Credits Engine** (`lib/credits.ts`) : debit, refund, balance, expiration, idempotence, solde insuffisant, transactions concurrentes
- **Next Step Engine** (`lib/next-step-engine.ts`) : recommandations par profil, edge cases (nouvel élève, élève avancé)
- **Trajectory** (`lib/trajectory.ts`) : milestones, progression, calcul trajectoire

#### 1.2 Bilan & Diagnostic
- **Bilan Renderer** (`lib/diagnostics/bilan-renderer.ts`) : 3 renderers (élève tutoiement, parents vouvoiement, nexus technique), micro-plans adaptatifs (Maths vs NSI), prérequis, couverture, labels dynamiques discipline/niveau
- **Signed Tokens** (`lib/diagnostics/signed-token.ts`) : sign, verify, expiry, tamper detection, audience restriction, token replay
- **Bilan Generator** (`lib/bilan-generator.ts`) : pipeline RAG→LLM, fallback si LLM échoue, timeout, retry, 3 bilans séquentiels
- **Prompt Context** (`lib/diagnostics/prompt-context.ts`) : construction contexte, données manquantes, sanitization
- **Safe Log** (`lib/diagnostics/safe-log.ts`) : PII masking, données sensibles jamais loguées
- **LLM Contract** (`lib/diagnostics/llm-contract.ts`) : validation Zod output LLM, malformed JSON, champs manquants

#### 1.3 Entitlements & Access
- **Entitlement Engine** (`lib/entitlement/engine.ts`) : SINGLE (noop si actif), EXTEND (prolonge endsAt), STACK (toujours créer), idempotence via sourceInvoiceId, suspension, révocation
- **Product Registry** (`lib/entitlement/types.ts`) : tous les productCodes, activation modes, features mapping
- **Access Rules** (`lib/access/rules.ts`) : résolution pour chaque combinaison rôle × feature × entitlement (matrice complète)
- **Access Guard** (`lib/access/guard.ts`) : requireFeature redirect, requireFeatureApi 403/401, rôles exemptés
- **Feature Catalog** (`lib/access/features.ts`) : 10 features, fallback modes (HIDE/DISABLE/REDIRECT), rolesExempt

#### 1.4 Facturation & Paiements
- **Invoice Engine** (`lib/invoice/`) : création, numérotation séquentielle, transitions (DRAFT→SENT→PAID→CANCELLED), PDF rendering, receipt PDF, email template, storage, access tokens, token révocation, send throttle
- **Payment Flow** : déclaration virement, validation atomique (payment + subscription + credits + invoice + UserDocument), rejet, anti-double paiement
- **Credits Allocation** : allocation post-paiement, calcul par plan, expiration

#### 1.5 Session Booking
- **Session Booking** (`lib/session-booking.ts`) : vérification disponibilité coach, vérification crédits, création booking, débit crédits idempotent, annulation + refund, overlap prevention, cycle de vie (SCHEDULED→CONFIRMED→IN_PROGRESS→COMPLETED→CANCELLED→NO_SHOW→RESCHEDULED)
- **Jitsi** (`lib/jitsi.ts`) : génération lien, token JWT, room naming

#### 1.6 ARIA & RAG
- **ARIA Client** (`lib/aria.ts`) : chat completion, streaming, error handling, timeout
- **ARIA Streaming** (`lib/aria-streaming.ts`) : stream parsing, chunk assembly, error mid-stream
- **Ollama Client** (`lib/ollama-client.ts`) : health check, generate, chat, model switching, timeout
- **RAG Client** (`lib/rag-client.ts`) : search, searchBySubject, collectionStats, buildRAGContext, filtres multi-champs, fallback si RAG down

#### 1.7 Auth & Security
- **Auth** (`auth.ts`, `auth.config.ts`) : authorize (email/password), bcrypt compare, élève non activé bloqué, JWT token generation, session callbacks
- **Password Reset** (`lib/password-reset-token.ts`) : token generation, hashing, expiry, validation, anti-enumeration
- **CSRF** (`lib/csrf.ts`) : same-origin check, production vs dev
- **Rate Limit** (`lib/rate-limit.ts`) : window, max requests, Redis vs in-memory fallback
- **Security Headers** (`lib/security-headers.ts`) : CSP, HSTS, X-Frame-Options
- **Guards** (`lib/guards.ts`) : requireRole, requireAnyRole, isErrorResponse
- **RBAC** (`lib/rbac.ts`) : 35+ policies × 5 rôles, ownership checks, 11 resources × 9 actions
- **Scopes** (`lib/scopes.ts`) : scope resolution, inheritance

#### 1.8 Validation
- **Zod Schemas** (`lib/validation/`) : common (email, password, phone), users (create, update), sessions (booking, report), payments, index barrel
- **Validations** (`lib/validations.ts`) : stageReservationSchema, bilanDiagnosticMathsSchema, contactSchema
- **Env Validation** (`lib/env-validation.ts`) : toutes les variables requises/optionnelles, types, defaults

#### 1.9 Utilitaires
- **Email** (`lib/email/mailer.ts`) : SMTP transport, MAIL_DISABLED guard, templates, error handling
- **Telegram** (`lib/telegram/client.ts`) : send message, TELEGRAM_DISABLED guard, error handling, retry
- **Logger** (`lib/logger.ts`) : niveaux, format, PII safe
- **Cron Jobs** (`lib/cron-jobs.ts`) : scheduling, execution tracking, idempotence
- **Translations** (`lib/translations.ts`) : toutes les clés, fallback, interpolation
- **Constants** (`lib/constants.ts`) : plans, pricing, crédits, cohérence des valeurs
- **Theme** (`lib/theme/tokens.ts`, `lib/theme/variants.ts`) : tokens HSL, CVA variants, cohérence design system

---

### 2. TESTS D'INTÉGRATION API — Chaque Route

#### 2.1 Auth Routes
- `POST /api/auth/[...nextauth]` : login success, login failure (wrong password, non-existent email, inactive student), session retrieval, logout
- `POST /api/auth/reset-password` : request (valid email, non-existent email → toujours success), execute (valid token, expired token, invalid token, weak password)

#### 2.2 Admin Routes (12)
- `GET /api/admin/dashboard` : RBAC (admin only, 403 pour autres rôles), données KPIs
- `GET /api/admin/analytics` : RBAC, métriques, filtres date
- `GET /api/admin/activities` : RBAC, pagination, filtres
- `GET/POST/PATCH/DELETE /api/admin/users` : CRUD complet, validation Zod, email unique, password optional on update, rôle assignment, suppression cascade
- `GET /api/admin/users/search` : recherche par nom/email, filtre ELEVE/PARENT, min 2 chars
- `GET/POST /api/admin/subscriptions` : liste, création, validation
- `GET/POST /api/admin/invoices` : liste, création, filtres
- `GET/PATCH /api/admin/invoices/[id]` : détail, modification, transitions valides/invalides
- `POST /api/admin/invoices/[id]/send` : envoi email, throttle, facture inexistante
- `GET/POST /api/admin/documents` : upload fichier, recherche utilisateur, validation type/taille fichier
- `POST /api/admin/recompute-ssn` : batch recalcul, ADMIN only
- `POST /api/admin/test-email` : envoi test SMTP, ADMIN only
- `GET /api/admin/directeur/stats` : KPIs directeur, ADMIN only

#### 2.3 Assistante Routes (8)
- Chaque route : RBAC (ASSISTANTE only), happy path, validation, edge cases
- `POST /api/assistant/activate-student` : création user ELEVE, token activation, email envoyé, doublon email

#### 2.4 Parent Routes (5)
- Chaque route : RBAC (PARENT only), ownership (ne voit que ses enfants)
- `POST /api/parent/children` : ajout enfant, lien parent-enfant
- `POST /api/parent/credit-request` : demande crédits, validation montant
- `POST /api/parent/subscription-requests` : demande changement formule

#### 2.5 Student Routes (8)
- Chaque route : RBAC (ELEVE only), ownership (ne voit que ses données)
- `GET /api/student/nexus-index` : calcul composite, données manquantes
- `GET /api/student/documents` : coffre-fort, accès propres documents uniquement
- `GET /api/student/trajectory` : trajectoire, milestones

#### 2.6 Coach Routes (3)
- `POST /api/coach/sessions/[id]/report` : création rapport, validation, session inexistante, session pas du coach

#### 2.7 ARIA Routes (3)
- `POST /api/aria/chat` : entitlement check (aria_maths/aria_nsi), streaming response, conversation persistence, LLM timeout, RAG fallback
- `GET /api/aria/conversations` : liste conversations propres, pagination
- `POST /api/aria/feedback` : feedback valide, conversation inexistante

#### 2.8 Assessment Routes (6)
- `POST /api/assessments/submit` : soumission complète, validation réponses, scoring pipeline, SSN calcul
- `GET /api/assessments/[id]/result` : résultats, domainScores, skillScores, SSN
- `GET /api/assessments/[id]/status` : statut pipeline (PENDING→SCORED→ANALYZED)
- `GET /api/assessments/[id]/export` : PDF generation, react-pdf rendering
- `POST /api/assessments/predict` : prédiction ML, données insuffisantes
- `POST /api/assessments/test` : test engine

#### 2.9 Session Routes (3)
- `POST /api/sessions/book` : entitlement check (credits_use), disponibilité coach, débit crédits, overlap prevention, notification
- `POST /api/sessions/cancel` : annulation, refund crédits, session passée non annulable
- `POST /api/sessions/video` : génération lien Jitsi, session inexistante

#### 2.10 Payment Routes (5)
- `POST /api/payments/bank-transfer/confirm` : déclaration virement, PARENT only, anti-double
- `GET /api/payments/check-pending` : vérification paiement en cours
- `GET /api/payments/pending` : liste staff, RBAC (ADMIN/ASSISTANTE)
- `POST /api/payments/validate` : approbation (transaction atomique complète), rejet, paiement inexistant
- `POST /api/payments/clictopay/init` : skeleton 501

#### 2.11 Transversales (14)
- `GET /api/health` : healthcheck, format réponse
- `POST /api/contact` : validation formulaire, email envoyé, rate limit
- `POST/GET /api/reservation` : réservation stage, upsert, Telegram notification, doublon email
- `GET /api/reservation/verify` : vérification réservation existante
- `GET /api/notifications` : notifications propres, auth required
- `POST /api/notify/email` : CSRF check, rate limit, body size 64KB max
- `POST /api/messages/send` : envoi message, auth required
- `GET /api/messages/conversations` : conversations propres
- `GET /api/me/next-step` : prochaine étape recommandée
- `POST /api/analytics/event` : tracking événement
- `GET /api/students/[studentId]/badges` : badges gamification
- `POST /api/programme/maths-1ere/progress` : progression programme
- `POST /api/programme/maths-terminale/progress` : progression programme
- `GET /api/diagnostics/definitions` : définitions diagnostiques (4 matières)
- `POST /api/bilan-gratuit` : inscription bilan, validation multi-étapes
- `POST /api/bilan-pallier2-maths` : soumission quiz, scoring V2, LLM bilans
- `POST /api/bilan-pallier2-maths/retry` : relance LLM
- `POST /api/stages/submit-diagnostic` : soumission QCM stage, scoring
- `POST /api/subscriptions/change` : changement formule
- `POST /api/subscriptions/aria-addon` : ajout add-on ARIA
- `GET /api/invoices/[id]/pdf` : téléchargement PDF
- `GET /api/invoices/[id]/receipt/pdf` : téléchargement reçu
- `GET /api/documents/[id]` : téléchargement document coffre-fort

---

### 3. TESTS RBAC — Matrice Complète

Pour CHAQUE route API, tester l'accès avec les 6 cas :
- Non authentifié → 401
- ADMIN → attendu (✅ ou ❌)
- ASSISTANTE → attendu
- COACH → attendu
- PARENT → attendu
- ELEVE → attendu

**Fichier** : `__tests__/api/rbac-complete-matrix.test.ts`
- Matrice 81 routes × 6 cas = **486 assertions minimum**

---

### 4. TESTS E2E — Parcours Utilisateur Complets

#### 4.1 Navigation & Pages Publiques
- **Toutes les 30 pages publiques** : chargement, titre, meta SEO, contenu visible, liens fonctionnels
- **Navbar** : tous les liens dropdown (Essentiel, Programmes, À propos, Connexion), mobile menu toggle
- **Footer** : tous les 9 liens exploration + 3 liens bas de page
- **CTAs Homepage** : chaque bouton CTA → bonne destination (bilan-gratuit, offres, contact)
- **Redirections** : 7 redirections legacy (inscription→bilan-gratuit, tarifs→offres, etc.)
- **404** : page inexistante → page 404
- **Robots.txt** : vérifie disallow /dashboard, /api, /auth
- **Sitemap** : vérifie toutes les URLs publiques présentes

#### 4.2 Authentification E2E
- **Login** : email + password → redirect /dashboard/{role} pour chaque rôle
- **Login échec** : mauvais password, email inexistant, élève non activé
- **Logout** : déconnexion → redirect /auth/signin
- **Activation élève** : /auth/activate?token=xxx → formulaire mdp → login
- **Activation token invalide** : message erreur, lien retour
- **Reset password** : demande → email → /auth/reset-password?token=xxx → nouveau mdp → login
- **Reset token expiré** : message erreur
- **Déjà connecté** : /auth/signin → redirect /dashboard/{role}
- **Session expirée** : accès dashboard → redirect /auth/signin
- **Protection middleware** : /dashboard/* sans auth → redirect /auth/signin

#### 4.3 Dashboard Admin E2E
- **Page principale** : KPIs affichés, stats système
- **Users CRUD** : créer utilisateur, modifier email, modifier rôle, supprimer, rechercher
- **Users validation** : email invalide, password trop court, doublon email
- **Analytics** : graphiques chargés, filtres fonctionnels
- **Subscriptions** : liste, filtres, actions
- **Activities** : journal, pagination
- **Tests Système** : page charge, tests exécutables
- **Documents** : rechercher utilisateur, uploader fichier, confirmer upload, vérifier coffre-fort
- **Facturation** : liste factures, créer facture, envoyer par email, télécharger PDF

#### 4.4 Dashboard Assistante E2E
- **Page principale** : KPIs, actions rapides
- **Students** : liste, recherche, activation compte élève (email envoyé)
- **Coaches** : liste, détail coach, modification matières
- **Subscriptions** : gestion abonnements
- **Credit Requests** : validation/rejet demandes crédits
- **Paiements** : liste paiements en attente, valider virement (vérifier transaction atomique), rejeter
- **Subscription Requests** : traitement demandes changement abo
- **Credits** : gestion crédits
- **Docs** : gestion documents

#### 4.5 Dashboard Coach E2E
- **Page principale** : sessions à venir, stats
- **Sessions** : liste, détail, rédiger rapport de session
- **Students** : profils élèves assignés
- **Availability** : créer créneaux, modifier, supprimer, vérifier pas d'overlap

#### 4.6 Dashboard Parent E2E
- **Page principale** : enfants, crédits, factures
- **Children** : liste enfants, ajouter enfant (dialog), profil enfant
- **Abonnements** : formules actives, changer formule (dialog), ajouter ARIA add-on (dialog)
- **Paiement** : déclarer virement bancaire, bannière "en cours d'analyse" si PENDING, confirmation
- **Ressources** : coffre-fort documents, téléchargement
- **Modales** : CreditPurchaseDialog, SubscriptionChangeDialog, AriaAddonDialog, InvoiceDetailsDialog, AddChildDialog

#### 4.7 Dashboard Élève E2E
- **Page principale** : crédits, badges, ARIA stats, Nexus Index
- **Mes Sessions** : historique sessions
- **Réserver Session** : choix coach, matière, créneau, confirmation, débit crédits
- **Ressources** : documents coffre-fort, téléchargement
- **ARIA Chat** : ouvrir chat, envoyer message, recevoir réponse streaming, feedback
- **Trajectoire** : /dashboard/trajectoire, timeline, milestones

#### 4.8 Bilan Gratuit E2E
- **Formulaire** : multi-étapes (parent + enfant + objectifs), validation chaque étape
- **Soumission** : POST → redirect /confirmation
- **Assessment** : /bilan-gratuit/assessment

#### 4.9 Bilan Pallier 2 Maths E2E
- **Formulaire** : 57K lignes, navigation entre sections
- **Soumission** : scoring V2, redirect /confirmation
- **Résultat** : /resultat/[id], 3 onglets (élève, parents, nexus), TrustScore badge
- **Polling** : auto-refresh pendant génération LLM
- **Signed tokens** : accès par audience (élève, parents), rejet audience nexus sans auth
- **Retry** : relance LLM si échec

#### 4.10 Stages E2E
- **Réservation** : formulaire, validation Zod, soumission, Telegram notification
- **Diagnostic QCM** : 50 questions, navigation, raccourcis clavier (A/B/C/D, N, Enter), transition Maths→NSI, soumission, résultats
- **Bilan stage** : /stages/fevrier-2026/bilan/[id]
- **Dashboard admin** : /admin/stages/fevrier-2026, KPIs, table, CSV export

#### 4.11 Programme Interactif E2E
- **Maths 1ère** : chargement page, 22 composants, navigation chapitres, ExerciseEngine, PythonIDE, InteractiveGraph, SkillTree, MathJax rendering
- **Maths Terminale** : chargement, navigation

#### 4.12 Session Vidéo E2E
- **/session/video** : chargement Jitsi Meet, auth required

---

### 5. TESTS DE SÉCURITÉ

- **JWT Escalation** : modifier le rôle dans le JWT → rejeté
- **CSRF** : requêtes cross-origin → bloquées en production
- **Rate Limiting** : dépasser le seuil → 429 Too Many Requests
- **SQL Injection** : inputs malicieux dans tous les champs de recherche/formulaire
- **XSS** : injection script dans champs texte (nom, email, message contact)
- **Path Traversal** : /api/documents/../../etc/passwd → 404
- **IDOR** : accéder aux données d'un autre utilisateur (parent voit enfant d'un autre parent)
- **Brute Force Login** : tentatives multiples → rate limited
- **Token Replay** : réutiliser un token d'activation/reset expiré
- **Password Policy** : mots de passe faibles rejetés (min 8 chars, 1 lettre, 1 chiffre)
- **Anti-Enumeration** : reset password avec email inexistant → même réponse que email existant
- **Session Fixation** : vérifier que le session token change après login
- **Cookie Flags** : httpOnly, sameSite, secure (en prod)
- **Content-Type Validation** : upload fichier avec mauvais MIME type
- **Body Size Limit** : requête > 64KB sur /api/notify/email → rejetée
- **Robots.txt** : /dashboard, /api, /auth interdits aux crawlers

---

### 6. TESTS DE CONCURRENCE & TRANSACTIONS

- **Double Booking** : 2 réservations simultanées même créneau → 1 seule acceptée
- **Credit Race Condition** : 2 débits simultanés avec solde insuffisant pour les 2 → 1 seul passe
- **Payment Idempotency** : soumettre 2 fois le même paiement → 1 seul enregistré
- **Invoice Sequence** : 2 factures créées simultanément → numéros séquentiels sans trou
- **Entitlement Idempotency** : activer 2 fois les mêmes entitlements → pas de doublon
- **Session Overlap** : créer 2 sessions qui se chevauchent pour le même coach → rejeté

---

### 7. TESTS DE PERFORMANCE & STRESS

- **API Response Time** : chaque route API < 500ms (P95)
- **Dashboard Load** : chaque dashboard < 2s (avec données réelles)
- **Homepage Load** : < 3s (9 sections GSAP)
- **LLM Pipeline** : bilan complet < 5min (3 appels séquentiels)
- **Search** : recherche utilisateurs < 200ms
- **PDF Generation** : facture PDF < 3s
- **Concurrent Users** : 50 utilisateurs simultanés sans dégradation
- **Database Queries** : aucune requête N+1, vérifier avec query logging
- **Memory Leaks** : pas de fuite mémoire après 1000 requêtes

---

### 8. TESTS D'ACCESSIBILITÉ

- **Toutes les pages** : axe-core scan (0 violations critical/serious)
- **Formulaires** : labels associés, aria-describedby, error messages liés
- **Navigation clavier** : tab order logique, focus visible, skip-to-content
- **Contraste couleurs** : ratio WCAG AA (4.5:1 texte, 3:1 grands textes)
- **Screen reader** : aria-labels sur boutons icônes, aria-live pour notifications
- **Responsive** : mobile (375px), tablet (768px), desktop (1280px)
- **Dialog** : aria-describedby, focus trap, Escape ferme

---

### 9. TESTS VISUELS & UI

- **Design System** : tokens HSL cohérents, CVA variants rendus correctement
- **Dark/Light Theme** : toutes les pages dans les 2 thèmes
- **Responsive Breakpoints** : 375px, 768px, 1024px, 1280px, 1536px
- **GSAP Animations** : homepage sections animées sans erreur JS
- **Loading States** : skeleton loaders affichés pendant chargement
- **Error States** : error.tsx affiché correctement pour chaque route
- **Empty States** : dashboards sans données → message approprié
- **Toast Notifications** : affichage, auto-dismiss, actions

---

### 10. TESTS DE DONNÉES & BASE DE DONNÉES

- **Schema Integrity** : 38 modèles, 20 enums, toutes les relations FK
- **Migrations** : 16 migrations appliquées séquentiellement sans erreur
- **Seed** : 9 users créés correctement, profils liés
- **Cascade Delete** : supprimer user → cascade sur Payment, StudentBadge, etc.
- **Unique Constraints** : email unique, StageReservation (email + academyId)
- **Indexes** : vérifier que les index existent et sont utilisés
- **Data Invariants** : toutes les contraintes documentées dans DATA_INVARIANTS.md
- **pgvector** : extension installée, embeddings stockés/recherchés correctement
- **Prisma Client** : singleton, pas de connection pool exhaustion

---

### 11. TESTS DE WORKFLOW COMPLETS (End-to-End Business)

#### 11.1 Workflow Inscription → Première Session
```
Parent remplit bilan-gratuit → Assistante crée compte élève → Email activation
→ Élève active compte → Parent déclare virement → Assistante valide paiement
→ Subscription activée + crédits alloués + facture générée + PDF coffre-fort
→ Élève réserve session → Coach confirme → Session → Rapport coach
```

#### 11.2 Workflow Diagnostic Complet
```
Visiteur → /bilan-pallier2-maths → Remplit formulaire → Scoring V2
→ TrustScore calculé → RAG search → 3 bilans LLM générés
→ Signed tokens créés → Élève consulte son bilan → Parents consultent leur bilan
→ Staff consulte bilan technique
```

#### 11.3 Workflow Stage Intensif
```
Visiteur → /stages/fevrier-2026 → Réservation (Telegram notif)
→ /diagnostic (50 QCM) → Scoring → Résultats
→ Admin consulte dashboard stages → Export CSV
```

#### 11.4 Workflow Paiement Complet
```
Parent → Déclare virement → Payment PENDING → Bannière amber
→ Assistante voit paiement en attente → Valide
→ Transaction atomique : Payment COMPLETED + Subscription ACTIVE + Credits alloués
→ Invoice PAID + PDF généré + stocké data/invoices/ + storage/documents/
→ UserDocument créé → Parent voit facture dans coffre-fort
→ Tentative double paiement → Bloquée
```

#### 11.5 Workflow ARIA Chat
```
Élève avec entitlement aria_maths → Ouvre chat → Envoie question
→ RAG search → Ollama streaming → Réponse affichée
→ Feedback (👍/👎) → Sauvegardé
→ Élève SANS entitlement → Redirect /access-required
```

#### 11.6 Workflow Admin Gestion Users
```
Admin → /dashboard/admin/users → Créer user (ELEVE)
→ Modifier email → Modifier rôle → Supprimer user
→ Vérifier cascade (sessions, crédits, etc.)
```

#### 11.7 Workflow Facturation
```
Admin → /dashboard/admin/facturation → Créer facture DRAFT
→ Ajouter items (productCode) → Passer en SENT → Envoyer email
→ Marquer PAID → Entitlements activés → PDF téléchargeable
→ Annuler facture → Entitlements suspendus
```

---

### 12. TESTS DE GÉNÉRATION DE DOCUMENTS & ARTEFACTS

- **Invoice PDF** : générer PDF, vérifier contenu (numéro, montant, items, date), format A4
- **Receipt PDF** : générer reçu, vérifier contenu
- **Assessment Export PDF** : générer PDF résultats, radar chart, scores
- **Bilan Markdown** : 3 renderers produisent du Markdown valide, pas de données manquantes
- **CSV Export** : export stages → CSV valide, toutes les colonnes, encodage UTF-8
- **UserDocument** : fichier stocké dans storage/documents/, accessible via API, type MIME correct
- **Invoice Storage** : PDF stocké dans data/invoices/ ET storage/documents/

---

### 13. TESTS DE CONFIGURATION & ENVIRONNEMENT

- **Env Validation** : toutes les variables requises présentes, types corrects
- **Env Missing** : variable manquante → erreur explicite au démarrage
- **Docker Build** : Dockerfile.prod build sans erreur
- **Docker Compose** : docker-compose.prod.yml up → tous les services healthy
- **Healthcheck** : /api/health retourne 200 avec status détaillé
- **Next.js Config** : next.config.mjs valide, standalone output, images domains
- **Prisma Generate** : `npx prisma generate` sans erreur
- **TypeScript** : `tsc --noEmit` 0 erreurs
- **ESLint** : `npm run lint` 0 erreurs
- **Build** : `npm run build` succès, toutes les pages générées

---

### 14. TESTS DE NOTIFICATION & COMMUNICATION

- **Email SMTP** : envoi via Hostinger, template HTML correct, MAIL_DISABLED respecté
- **Telegram Bot** : envoi message, TELEGRAM_DISABLED respecté, format message
- **In-app Notifications** : création, lecture, marquage lu, bell badge count
- **Email Activation** : token dans l'email, lien fonctionnel
- **Email Reset Password** : token dans l'email, lien fonctionnel, expiration
- **Email Invoice** : facture PDF en pièce jointe, template correct

---

### 15. TESTS DE RÉGRESSION

Pour chaque bug corrigé précédemment :
- **PUT→PATCH admin users** : vérifier que PATCH est utilisé, pas PUT
- **Password vide sur update** : password undefined si vide, pas ""
- **DialogContent aria-describedby** : pas de warning accessibilité
- **Bouton upload documents** : activé quand file + selectedUser sont set
- **LLM failure ne bloque pas** : status COMPLETED même si LLM échoue
- **Anti-double paiement** : bannière amber si PENDING existe

---

## FORMAT DE SORTIE ATTENDU

Pour chaque test, fournis :

```
### [CATÉGORIE] — [Nom du test]

**Fichier** : `chemin/complet/du/fichier.test.ts`
**Type** : unit | integration | e2e | contract | stress | security | accessibility
**Priorité** : P0 | P1 | P2
**Statut** : NOUVEAU | COMPLÉTER [fichier existant]

**Description** : Ce que ce test vérifie

**Cas de test** :
1. ✅ Happy path — [description]
2. ❌ Error case — [description]
3. 🔄 Edge case — [description]
4. 🔒 Security — [description]

**Code squelette** :
```typescript
describe('[Suite]', () => {
  it('should [comportement attendu]', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```
```

---

## CONTRAINTES TECHNIQUES

- **Framework tests** : Jest 29 (unit/API) + Playwright 1.58 (E2E)
- **Environnement Jest** : jsdom (custom fetch polyfill) pour unit, node pour DB integration
- **Mocking** : Prisma mocké via `jest.mock('@/lib/prisma')`, NextAuth via `jest.mock('next-auth')`
- **E2E** : Playwright avec Chromium, fixtures pour auth state
- **Coverage thresholds** : branches 60%, functions 69%, lines 70%, statements 70%
- **CI** : GitHub Actions, 7 jobs parallèles, E2E avec continue-on-error
- **DB Tests** : `jest.config.db.js` (node, serial, maxWorkers: 1)
- **Timeout E2E** : globalTimeout 11min, step 12min, job 20min

---

## OBJECTIF FINAL

Proposer une liste COMPLÈTE et PRIORISÉE de tests qui, une fois tous implémentés, garantissent :

1. **0 erreur** sur toutes les routes API (81 endpoints)
2. **0 bug** sur toutes les pages (74 pages)
3. **0 dysfonctionnement** sur tous les workflows (7 workflows business)
4. **0 faille** de sécurité (RBAC, CSRF, XSS, IDOR, injection)
5. **0 régression** sur les bugs précédemment corrigés
6. **100% des boutons** fonctionnels
7. **100% des liens** valides
8. **100% des formulaires** validés
9. **100% des notifications** envoyées
10. **100% des documents** générés correctement
11. **100% des transactions** atomiques et idempotentes
12. **100% des rôles** correctement restreints

Organise ta réponse par priorité (P0 d'abord) et par catégorie. Estime le nombre total de tests et le temps d'implémentation.
