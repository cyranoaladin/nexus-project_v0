# DOC-3 — Spec fonctionnelle des dashboards par rôle (actuel → cible)

> État actuel : source-grounded depuis les page.tsx réels et les API qu'ils appellent.
> État cible : adossé aux SSOT (pricing.canonical.json, PRODUCT_REGISTRY, lib/access/features.ts).
> Date : 2026-06-27

---

## Sommaire

1. [État actuel par rôle](#1-état-actuel-par-rôle)
2. [Trous de gestion ADMIN / ASSISTANTE](#2-trous-de-gestion-admin--assistante)
3. [État cible par rôle](#3-état-cible-par-rôle)
4. [Findings DOC-2 impactant les dashboards](#4-findings-doc-2-impactant-les-dashboards)

---

## 1. État actuel par rôle

### ADMIN (9 pages)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard/admin` | Stats globales (users, revenue, sessions, subscriptions), activities récentes, systemHealth | — | `GET /api/admin/dashboard` |
| `/dashboard/admin/users` | User[] (email, role, firstName, lastName) paginé + filtré par rôle | Create/Update/Delete User, CoachProfile-specific data | `GET/POST/PATCH/DELETE /api/admin/users` |
| `/dashboard/admin/subscriptions` | Subscription[] (planName, status, startDate, endDate, student, parent) paginé | Update status + endDate | `GET /api/admin/subscriptions`, `PUT /api/admin/subscriptions` |
| `/dashboard/admin/analytics` | Revenue, userGrowth, sessionData, subscriptionData, creditData par période | — | `GET /api/admin/analytics?period=&type=` |
| `/dashboard/admin/activities` | Activity log paginé (type, title, description, student, coach) | — | `GET /api/admin/activities` |
| `/dashboard/admin/stages` | Stage[] avec reservationCounts, KPIs, sessions, coaches | CRUD Stage, CRUD StageSession, assign/remove StageCoach | `GET/POST/PATCH/DELETE /api/admin/stages/*` |
| `/dashboard/admin/facturation` | Invoice[] paginé (number, status, customer, items, total) | Create Invoice, MARK_SENT/MARK_PAID/CANCEL | `GET/POST /api/admin/invoices`, `PATCH /api/admin/invoices/[id]` |
| `/dashboard/admin/documents` | User search pour upload | Upload UserDocument | `POST /api/admin/documents`, `GET /api/admin/users/search` |
| `/dashboard/admin/tests` | Config SMTP (variables, configured status) | Test SMTP config, envoyer email test | `GET/POST /api/admin/test-email` |

### ASSISTANTE (16 pages, dont 2 redirects)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard/assistante` | Stats (students, coaches, sessions, revenue, pending counts), todaySessions, recentActivities | — | `GET /api/assistante/dashboard` |
| `/dashboard/assistante/students` | Student[] (name, email, grade, school, creditBalance) | Create parent+student pair | `GET /api/assistante/students/credits`, `POST /api/assistante/students` |
| `/dashboard/assistante/students/[id]` | Student profile, creditBalance, transactions, assignments | Resend activation, reset password | `GET /api/assistante/students/[id]`, `POST /api/auth/resend-activation`, `POST /api/auth/reset-password` |
| `/dashboard/assistante/coaches` | Coach[] (name, email, pseudonym, subjects, availability) | CRUD Coach (create/update/delete) | `GET/POST/PUT/DELETE /api/assistante/coaches/manage` |
| `/dashboard/assistante/assignments` | Students + Coaches + Assignments (type, status, subjects, startsAt) | Create assignment, end assignment | `GET /api/assistante/students`, `GET /api/assistante/coaches`, `GET/POST /api/assistante/assignments`, `PATCH /api/assistante/assignments/[id]` |
| `/dashboard/assistante/stages` | Stage[] avec reservations | Confirm reservation | `GET /api/assistante/stages`, `GET /api/stages/[slug]/reservations`, `POST /api/stages/[slug]/reservations/[id]/confirm` |
| `/dashboard/assistante/stages/planning` | Planning events (sessions + stages) par semaine | Create session (simple + récurrente), cancel session | `GET /api/assistante/planning`, `POST /api/assistante/sessions`, `POST /api/sessions/cancel` |
| `/dashboard/assistante/planning` | Re-export de `stages/planning` | (idem) | (idem) |
| `/dashboard/assistante/subscriptions` | Pending subscriptions, change requests, active subscriptions | Approve/reject subscription, approve/reject change request | `GET /api/assistante/subscriptions`, `POST /api/assistante/subscriptions`, `GET/PATCH /api/assistante/subscription-requests` |
| `/dashboard/assistante/subscription-requests` | Redirect → `/subscriptions?tab=requests` | — | — |
| `/dashboard/assistante/credits` | Student[] avec creditBalance | Add/remove credits | `GET /api/assistante/students/credits`, `POST /api/assistante/students/credits` |
| `/dashboard/assistante/credit-requests` | CreditRequest[] (student, parent, amount, description) | Approve/reject credit request | `GET/POST /api/assistante/credit-requests` |
| `/dashboard/assistante/paiements` | Payment[] pending (user, amount, method, metadata) | Approve/reject payment | `GET /api/payments/pending`, `POST /api/payments/validate` |
| `/dashboard/assistante/facturation` | (via NexusInvoiceGenerator component) | Create Invoice | `POST /api/admin/invoices` |
| `/dashboard/assistante/devis` | iframe `/dashboard/assistante/devis/app` | — (iframe interne) | — |
| `/dashboard/assistante/docs` | Docs internes (16 fichiers MD/JSON depuis filesystem) | — | — (lecture filesystem serveur) |

### COACH (16 pages)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard/coach` | Dashboard (students, sessions, alerts, bilans), EAM summary | — | `GET /api/coach/dashboard`, `GET /api/coach/students/eam-summary` |
| `/dashboard/coach/students` | Student[] (from dashboard endpoint) | — | `GET /api/coach/dashboard` |
| `/dashboard/coach/eleve/[id]` | Student dossier complet | — | `GET /api/coach/students/[id]/dossier` |
| `/dashboard/coach/sessions` | Today + week sessions | SessionReport (via SessionReportDialog) | `GET /api/coach/dashboard` |
| `/dashboard/coach/availability` | (via CoachAvailability component) | (via component) | (component gère ses propres API) |
| `/dashboard/coach/stages` | Coach stages, enrolled students | Create/update StageBilan | `GET /api/coach/stages`, `POST /api/stages/[slug]/bilans` |
| `/dashboard/coach/stages/[slug]/bilan/[id]` | Stage + existing StageBilan | Save/publish StageBilan | `GET /api/coach/stages`, `GET/POST /api/stages/[slug]/bilans` |
| `/dashboard/coach/npc` | CopySubmission[] (status, student, report, aiJob) | — | prisma direct (server component) |
| `/dashboard/coach/npc/reports/[id]` | PedagogicalReport + CompetenceMatrix + RemediationRoadmap | — | prisma direct (server component) |
| `/dashboard/coach/npc/submissions/[id]/upload` | CopySubmission + CopyPage[] | File upload (via FileUploadZone) | prisma direct (server component) |
| `/dashboard/coach/nsi-pratique-2026` | NSI students progress | — | `GET /api/coach/nsi-pratique-2026/students` |
| `/dashboard/coach/nsi-pratique-2026/[id]` | NSI student detail progress | — | `GET /api/coach/nsi-pratique-2026/students/[id]/progress` |
| `/dashboard/coach/eaf-stage-printemps` | EAF students + bilan status | — | `GET /api/coach/eaf-stage-printemps/students` |
| `/dashboard/coach/eaf-stage-printemps/[id]` | EAF bilan data | Save/complete/validate/regenerate bilan | `GET/POST/PATCH /api/coach/eaf-stage-printemps/students/[id]/report`, `POST .../regenerate` |
| `/dashboard/coach/maths-premiere-stage-printemps` | Maths students + bilan status | — | `GET /api/coach/maths-premiere-stage-printemps/students` |
| `/dashboard/coach/maths-premiere-stage-printemps/[id]` | Maths bilan data | Save/complete/validate/regenerate bilan | `GET/POST/PATCH .../report`, `POST .../regenerate-parent`, `POST .../regenerate-student` |

### PARENT (10 pages, dont 1 redirect)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard/parent` | Dashboard (enfants, subscriptions, payments, badges) | — | `GET /api/parent/dashboard` |
| `/dashboard/parent/children` | Redirect → `/dashboard/parent` | — | — |
| `/dashboard/parent/enfant/[id]` | Child detail (NexusIndex, progression, cohort) | — | `GET /api/parent/dashboard` (filtré) |
| `/dashboard/parent/stages` | Coach bilans + legacy StageBilans + reservations | — | `GET /api/parent/stages` |
| `/dashboard/parent/ressources` | UserDocument[] (shared documents) | — | prisma direct (server component) |
| `/dashboard/parent/factures` | Invoice[] (par email client) | — | prisma direct (server component) |
| `/dashboard/parent/paiement` | Pending payment status | Déclarer virement bancaire | `GET /api/payments/check-pending`, `POST /api/payments/bank-transfer/confirm` |
| `/dashboard/parent/paiement/confirmation` | — (page statique) | — | — |
| `/dashboard/parent/abonnements` | Subscriptions, plans, addons, packs | Demander changement plan / addon ARIA | `GET /api/parent/subscriptions`, `POST /api/parent/subscription-requests` |
| `/dashboard/parent/npc` | CopySubmission[] des enfants | — | prisma direct (server component) |

### ELEVE (17 pages, dont 2 redirects)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard/eleve` | Dashboard complet (cockpit, EAM, parcours, sessions, matières, bilans, stages, survie, automatismes, ARIA) | — | `GET /api/student/dashboard` |
| `/dashboard/eleve/sessions` | Redirect → `#sessions` | — | — |
| `/dashboard/eleve/ressources` | Redirect → `#resources` | — | — |
| `/dashboard/eleve/documents` | UserDocument[] | — | `GET /api/student/profile`, `GET /api/students/[id]/documents` |
| `/dashboard/eleve/stages` | Bilans de stage (studentMarkdown) | — | `GET /api/eleve/stages` |
| `/dashboard/eleve/bilans/[id]` | Bilan individuel (par publicShareId) | — | `GET /api/student/bilans/[id]` |
| `/dashboard/eleve/eam` | (via EAMPrep component) | (via component) | (component gère API) |
| `/dashboard/eleve/automatismes` | Séries + questions automatismes | Tentatives automatismes | (components gèrent API) |
| `/dashboard/eleve/nsi-pratique-2026` | NSI progress (subjects, patterns, flashcards, mock exams) | Progress sync | `GET /api/student/dashboard`, via `useNsiProgress` hook |
| `/dashboard/eleve/npc` | CopySubmission[] + PedagogicalReport | — | prisma direct (server component) |
| `/dashboard/eleve/programme/maths` | Skill graph (from generated JSON), QCM bank (STMG) | — | prisma (academicTrack), filesystem (skills JSON) |
| `/dashboard/eleve/programme/[subject]` | Skill graph par matière | — | prisma (academicTrack), filesystem |
| `/dashboard/eleve/stage-eam-stmg` | Stage EAM STMG overview | — | prisma (student check) |
| `/dashboard/eleve/stage-eam-stmg/diagnostic` | Diagnostic EAM STMG | (via component) | prisma (student check) |
| `/dashboard/eleve/stage-eam-stmg/livret` | Livret EAM STMG | (via component) | prisma (student check) |
| `/dashboard/eleve/questionnaires/eaf-stage-printemps` | Draft questionnaire EAF (8 étapes) | Save draft / submit | `GET/POST /api/eleve/questionnaire-eaf-stage-printemps` |
| `/dashboard/eleve/questionnaires/maths-premiere-stage-printemps` | Draft questionnaire maths (9 étapes) | Save draft / submit | `GET/POST /api/eleve/questionnaire-maths-premiere-stage-printemps` |

### Partagé (2 pages)

| Route | Lit | Mute | API |
|-------|-----|------|-----|
| `/dashboard` | Session (rôle) | — | Redirect par rôle |
| `/dashboard/trajectoire` | Trajectory, Bilan | — | — |

---

## 2. Trous de gestion ADMIN / ASSISTANTE

Ce que l'admin et l'assistante **NE PEUVENT PAS** faire depuis leur interface actuelle. Input direct de DOC-4.

### Configuration des règles métier

| Besoin | Possible aujourd'hui ? | Preuve |
|--------|:---:|--------|
| Modifier les tarifs (offres, prix, échéanciers) | **NON** | Tarifs dans `data/pricing.canonical.json` — fichier statique, pas d'UI d'édition |
| Modifier les règles de groupe (group_max, min_open) | **NON** | `data/pricing.canonical.json` → `rules.group_*` — fichier statique |
| Modifier les règles de paiement (acompte %, cap remises) | **NON** | `data/pricing.canonical.json` → `rules.payment` — fichier statique |
| Modifier les règles de remise (fratrie, ancien élève, parrainage) | **NON** | `data/pricing.canonical.json` → `rules.discounts` — fichier statique |
| Configurer les produits/entitlements (durées, crédits, features) | **NON** | `lib/entitlement/types.ts` → `PRODUCT_REGISTRY` — code TypeScript, pas de runtime config |
| Configurer les features/gating | **NON** | `lib/access/features.ts` — code TypeScript |
| Modifier les rate-limit presets | **NON** | `lib/rate-limit/presets.ts` — code TypeScript |

### CRUD des entités

| Besoin | ADMIN | ASSISTANTE | Manques |
|--------|:---:|:---:|--------|
| CRUD Users | **OUI** (`/admin/users`) | **NON** (pas de page users) | ASSISTANTE ne peut pas créer d'admin/assistante |
| CRUD Coaches | **NON** (pas de page) | **OUI** (`/assistante/coaches`) | ADMIN n'a pas de page coach dédiée |
| CRUD Students | **NON** (via users page, partiel) | **OUI** (`/assistante/students`) | ADMIN crée des users génériques, pas spécifiquement des étudiants |
| CRUD Stages | **OUI** (`/admin/stages`) | **Partiel** (`/assistante/stages` : lecture + confirm, pas de create/edit/delete) | ASSISTANTE ne peut pas créer ni éditer de stages |
| CRUD Invoices | **OUI** (`/admin/facturation`) | **OUI** (`/assistante/facturation`, même composant) | — |
| CRUD Assignments | **NON** (pas de page) | **OUI** (`/assistante/assignments`) | ADMIN n'a pas de page d'affectation |
| CRUD Subscriptions | **Partiel** (`/admin/subscriptions` : edit status/endDate) | **OUI** (`/assistante/subscriptions` : approve/reject) | Ni l'un ni l'autre ne peut créer une subscription directement |
| CRUD Documents | **OUI** (`/admin/documents` : upload) | **OUI** (via `StudentDocumentsManager` dans student detail) | Pas de vue globale des documents |
| CRUD Badges | **NON** | **NON** | Badges gérés uniquement par seed/code |
| CRUD PedagogicalContent | **NON** | **NON** | Contenu pédagogique (embeddings, RAG) sans interface |
| CRUD Notifications (templates) | **NON** | **NON** | Notifications créées en code |

### Gestion des ressources pédagogiques

| Besoin | Possible ? | Preuve |
|--------|:---:|--------|
| Upload/gérer des contenus RAG (ChromaDB) | **NON** | Ingestion via `infra-ingestor-1` (process externe), pas d'UI |
| Gérer les curriculum data (skill graphs) | **NON** | Fichiers JSON statiques dans `data/` et `programmes/generated/` |
| Gérer les question banks (QCM, diagnostics) | **NON** | Code TypeScript dans `lib/assessments/questions/`, `lib/survival/qcm-bank.ts` |
| Gérer les définitions de diagnostics | **NON** | Code TypeScript dans `lib/diagnostics/definitions/*.ts` |

### Supervision & synchronisations

| Besoin | Possible ? | Preuve |
|--------|:---:|--------|
| Voir l'état des crons (dernière exécution, erreurs) | **NON** | `CronExecution` model existe mais aucun dashboard ne le lit |
| Déclencher manuellement un cron | **NON** | Crons dans `lib/cron-jobs.ts`, pas de route de déclenchement |
| Voir les jobs IA en cours/échoués (NPC) | **Partiel** (coach NPC dashboard montre le status) | ADMIN/ASSISTANTE n'ont pas de vue NPC |
| Voir les logs d'audit (NpcAuditLog) | **NON** | Model existe, pas de dashboard |
| Recomputer SSN/UAI batch | **OUI** (`POST /api/admin/recompute-ssn`) | Mais pas de UI — endpoint seulement |
| Monitorer les rate-limits | **NON** | MemoryStore en dev, pas de dashboard |
| Superviser ARIA (conversations, tokens, feedback) | **NON** | Pas de vue admin sur AriaConversation/AriaMessage |

### Facturation avancée

| Besoin | Possible ? | Preuve |
|--------|:---:|--------|
| Créer des échéanciers multi-factures | **NON** | Une facture à la fois dans `/admin/facturation` |
| Relancer une facture impayée | **NON** | Pas de MARK_OVERDUE dans la machine à états Invoice |
| Gérer les avoirs / remboursements | **NON** | CGV prévoit les remboursements (`lib/cgv-policy.ts`) mais pas d'UI |
| Voir la relation Payment → Invoice | **NON** | Pas de FK, pas de vue croisée (DOC-2 Signal 4) |
| Appliquer les remises canoniques (fratrie, parrainage, carte Nexus) | **NON** (via presets dans le composant, pas dynamique) | `NEXUS_PRESETS` hardcodés dans le composant facturation |

---

## 3. État cible par rôle

> Cette section est une couche de design/jugement, assumée comme telle.
> Adossée aux SSOT, pas réinventée.

### Principes

1. **SSOT-driven** : tout écran de configuration lit/écrit dans les SSOT existants, pas dans un état parallèle
2. **RBAC strict** : ADMIN full access, ASSISTANTE délégation opérationnelle (DOC-4 définira la matrice précise)
3. **Findings DOC-2 résolus** : le dashboard cible ne perpétue pas les incohérences connues (R2, R5, R8)

### ADMIN cible

**Conservé tel quel** :
- Dashboard KPIs (`/admin`)
- Analytics (`/admin/analytics`)
- Activity log (`/admin/activities`)
- Stage lifecycle CRUD (`/admin/stages`)
- Email tests (`/admin/tests`)

**Étendu** :
- `/admin/users` : conserver, ajouter filtres avancés + audit trail
- `/admin/subscriptions` : étendre avec création directe, lien vers factures associées
- `/admin/facturation` : résoudre R2 (afficher credits effectifs vs annoncés), résoudre R3 (afficher montants en millimes cohérents), ajouter vue croisée Payment→Invoice, ajouter échéanciers
- `/admin/documents` : ajouter vue globale des documents uploadés + filtres

**Nouveau** :
- `/admin/entitlements` : vue CRUD des entitlements actifs par user, avec lien vers Invoice source. Permet de diagnostiquer R2 en production.
- `/admin/config/pricing` : UI de consultation (lecture seule) de `pricing.canonical.json` avec mise en avant des écarts PRODUCT_REGISTRY (R2, R10)
- `/admin/config/products` : UI de consultation du PRODUCT_REGISTRY (14 produits, modes, features, crédits)
- `/admin/crons` : vue de `CronExecution` (job, dernière exécution, status, erreurs), bouton de déclenchement manuel
- `/admin/audit` : vue unifiée `NpcAuditLog` + `Invoice.events` (audit trail facturation)
- `/admin/aria` : stats ARIA (conversations, tokens consommés, feedback), pas de CRUD
- `/admin/assignments` : vue globale des CoachStudentAssignment avec détection des incohérences R5 (coachId orphelins)

### ASSISTANTE cible

**Conservé tel quel** :
- Dashboard (`/assistante`)
- Students CRUD (`/assistante/students`)
- Coaches CRUD (`/assistante/coaches`)
- Assignments (`/assistante/assignments`) — étendre avec détection R5
- Planning / sessions (`/assistante/planning`)
- Credits / credit requests (`/assistante/credits`, `/assistante/credit-requests`)
- Payments validation (`/assistante/paiements`)
- Subscriptions / requests (`/assistante/subscriptions`)
- Facturation (`/assistante/facturation`)
- Devis (`/assistante/devis`)
- Docs internes (`/assistante/docs`)

**Étendu** :
- `/assistante/students/[id]` : ajouter vue des entitlements actifs du student, bilans récents, trajectoire
- `/assistante/stages` : ajouter CRUD stages (create/edit/delete, pas seulement lecture + confirm)
- `/assistante/assignments` : afficher un warning quand un coachId existe sur des records (Bilan, SessionBooking) pour un assignment ENDED (R5)

**Nouveau** :
- `/assistante/reservations` : vue consolidée de toutes les StageReservation avec résolution du double statut (R4) — afficher `richStatus` seul, ignorer `status` legacy
- `/assistante/entitlements` : vue lecture seule des entitlements actifs (pour support client)

### COACH cible

**Conservé tel quel** :
- Tout le dashboard existant (16 pages couvrent bien les besoins)

**Étendu** :
- `/coach/stages/[slug]/bilan/[id]` : migrer de StageBilan vers Bilan (convergence Signal 1). Le formulaire écrit dans Bilan avec `type=STAGE_POST`, pas dans StageBilan.
- `/coach/eleve/[id]` : ajouter vue des entitlements actifs de l'élève (read-only), trajectoire

**Supprimé** :
- Aucune page affichant des données de StudentReport (modèle mort R8) — vérifié : aucune page coach ne lit StudentReport.

### PARENT cible

**Conservé tel quel** :
- Tout le dashboard existant (10 pages)

**Étendu** :
- `/parent/abonnements` : afficher les crédits effectifs octroyés par plan (résoudre R2 côté affichage — aligner sur PRODUCT_REGISTRY, pas sur canonical JSON annoncé)
- `/parent/paiement` : activer le paiement carte (actuellement désactivé "Bientôt disponible")

### ELEVE cible

**Conservé tel quel** :
- Tout le dashboard existant (17 pages)

**Pas de changement** : le dashboard élève est le plus riche et le mieux couvert. Les évolutions viendront de la pédagogie (nouveaux modules) et pas de la restructuration backend.

---

## 4. Findings DOC-2 impactant les dashboards

### R2 — Collision crédits : impact sur 3 dashboards

| Dashboard | Impact | Action cible |
|-----------|--------|-------------|
| ADMIN facturation | L'admin crée une facture avec ACCES_PLATEFORME → MARK_PAID → 4 crédits octroyés alors que le plan annonce 0 | Afficher un warning dans le composant facturation quand le productCode résolu octroie des crédits différents du plan source |
| ASSISTANTE paiements | L'assistante valide un paiement bank_transfer pour ACCES_PLATEFORME → même collision | Même warning dans la vue validation |
| PARENT abonnements | Le parent voit "0 crédits inclus" pour Accès Plateforme mais reçoit 4 crédits | Aligner l'affichage sur les crédits effectifs (PRODUCT_REGISTRY) |

**Extension R2** (découverte lors de DOC-3) : la collision est systématique sur les 3 plans :

| Plan canonical (`pricing.canonical.json:1336-1357`) | credits annoncés | PRODUCT_REGISTRY (`lib/entitlement/types.ts`) | credits octroyés |
|---|:---:|---|:---:|
| ACCES_PLATEFORME | 0 | ABONNEMENT_ESSENTIEL (`:133`) | **4** |
| HYBRIDE | 4 | ABONNEMENT_HYBRIDE (`:142`) | **8** |
| IMMERSION | 8 | ABONNEMENT_IMMERSION (`:151`) | **16** |

### R3 — Float vs Int millimes : impact facturation

Les pages `/admin/facturation` et `/assistante/facturation` convertissent TND → millimes côté client avant d'appeler l'API. Si cette conversion utilise `Math.round()` sur un Float, des centimes peuvent être perdus.

### R4 — Double statut StageReservation : impact assistante stages

La page `/assistante/stages` lit les réservations. Elle devrait afficher `richStatus` (enum) et ignorer `status` (String legacy) pour éviter les incohérences.

### R5 — coachId non synchronisé : impact assignments

La page `/assistante/assignments` permet de terminer un assignment mais ne met pas à jour les `coachId` sur les Bilan, SessionBooking, etc. existants. Le dashboard cible devrait afficher les records orphelins.

### R8 — StudentReport mort : aucun impact dashboard

Vérifié : aucune page dashboard (aucun des 70 page.tsx) ne lit `StudentReport` ni n'appelle `prisma.studentReport.find*`. Le modèle est invisible depuis toutes les interfaces. Suppression sans impact sur les dashboards.

---

> **FIN DOC-3** — En attente de validation avant DOC-4.
