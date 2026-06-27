# DOC-3 — Spec fonctionnelle des dashboards par rôle (actuel → cible) — v2

> État actuel : coordonnées fichier:ligne pour chaque page et chaque appel API.
> Trous de gestion : prouvés par grep d'absence contre l'inventaire DOC-1.
> État cible : adossé aux SSOT. Date : 2026-06-27

---

## Sommaire

1. [État actuel par rôle](#1-état-actuel-par-rôle)
2. [Trous de gestion ADMIN / ASSISTANTE](#2-trous-de-gestion-admin--assistante)
3. [État cible par rôle](#3-état-cible-par-rôle)
4. [Findings DOC-2 impactant les dashboards](#4-findings-doc-2-impactant-les-dashboards)

---

## 1. État actuel par rôle

### ADMIN (9 pages)

| Page (fichier) | Lit | Mute | API (avec ligne du fetch) |
|----------------|-----|------|--------------------------|
| `app/dashboard/admin/page.tsx` | Stats globales (users, revenue, sessions, subscriptions), recentActivities, systemHealth | — | `GET /api/admin/dashboard` (`:91`) |
| `app/dashboard/admin/users/page.tsx` | User[] paginé + filtré par rôle | Create User, Update User, Delete User | `GET /api/admin/users` (`:76`), `POST` (`:108`), `PATCH` (`:148`), `DELETE` (`:192`) |
| `app/dashboard/admin/subscriptions/page.tsx` | Subscription[] (planName, status, student, parent) paginé | Update status + endDate | `GET /api/admin/subscriptions` (`:66`), `PUT` (`:105`) |
| `app/dashboard/admin/analytics/page.tsx` | Revenue, userGrowth, sessions, credits par période | — | `GET /api/admin/analytics` (`:80`) |
| `app/dashboard/admin/activities/page.tsx` | Activity log paginé | — | `GET /api/admin/activities` (`:50`) |
| `app/dashboard/admin/stages/page.tsx` | Stage[] + KPIs + sessions + coaches | CRUD Stage, CRUD StageSession, assign/remove StageCoach | `GET /api/admin/stages` (`:552`), `GET .../[id]` (`:577`), `POST` (`:636`), `PATCH` (`:668`), `DELETE` (`:701`), `POST .../sessions` (`:742`), `POST .../coaches` (`:776`), `DELETE .../coaches` (`:805`), `GET /api/admin/users?role=COACH` (`:597`) |
| `app/dashboard/admin/facturation/page.tsx` | Invoice[] paginé (number, status, customer, items, total) | Create Invoice, MARK_SENT / MARK_PAID / CANCEL | `GET /api/admin/invoices` (`:174`), `POST` (`:269`), `PATCH .../[id]` (`:331`) |
| `app/dashboard/admin/documents/page.tsx` | (server component, délègue à DocumentUploadForm) | Upload UserDocument | `POST /api/admin/documents` (via composant), `GET /api/admin/users/search` (via composant) |
| `app/dashboard/admin/tests/page.tsx` | Config SMTP (variables, status) | Test SMTP, envoyer email test | `GET /api/admin/test-email` (`:51`), `POST` (`:69`, `:168`, `:184`) |

### ASSISTANTE (16 pages, dont 2 redirects et 1 re-export)

| Page (fichier) | Lit | Mute | API (avec ligne du fetch) |
|----------------|-----|------|--------------------------|
| `app/dashboard/assistante/page.tsx` | Stats (students, coaches, sessions, revenue, pending counts), todaySessions, recentActivities | — | `GET /api/assistante/dashboard` (`:67`) |
| `app/dashboard/assistante/students/page.tsx` | Student[] (name, email, grade, creditBalance) | Create parent+student pair | `GET /api/assistante/students/credits` (`:63`), `POST /api/assistante/students` (`:92`) |
| `app/dashboard/assistante/students/[studentId]/page.tsx` | Student profile, creditBalance, transactions, assignments | Resend activation, reset password | `GET /api/assistante/students/[id]` (`:105`), `POST /api/auth/resend-activation` (`:131`), `POST /api/auth/reset-password` (`:147`) |
| `app/dashboard/assistante/coaches/page.tsx` | Coach[] (name, email, pseudonym, subjects) | CRUD Coach | `GET /api/assistante/coaches/manage` (`:105`), `POST` (`:140`), `PUT .../[id]` (`:168`), `DELETE .../[id]` (`:196`) |
| `app/dashboard/assistante/assignments/page.tsx` | Students + Coaches + Assignments (type, status, subjects) | Create assignment, end assignment (ENDED) | `GET /api/assistante/students` (`:141`), `GET /api/assistante/coaches` (`:158`), `GET /api/assistante/assignments` (`:163`), `POST` (`:214`), `PATCH .../[id]` (`:249`) |
| `app/dashboard/assistante/stages/page.tsx` | Stage[] avec reservations | Confirm reservation | `GET /api/assistante/stages` (`:75`), `GET /api/stages/[slug]/reservations` (`:88`), `POST .../confirm` (`:108`) |
| `app/dashboard/assistante/stages/planning/page.tsx` | Planning events (sessions + stages) par semaine | Create session (simple + récurrente), cancel session | `GET /api/assistante/planning` (`:157`), `GET /api/assistante/students` (`:181`), `GET /api/assistante/coaches` (`:208`), `POST /api/assistante/sessions` (`:272`), `POST /api/sessions/cancel` (`:309`) |
| `app/dashboard/assistante/planning/page.tsx` | Re-export (`:1`) de `../stages/planning/page` | (idem) | (idem) |
| `app/dashboard/assistante/subscriptions/page.tsx` | Pending subscriptions, change requests, active subscriptions | Approve/reject subscription, approve/reject change request | `GET /api/assistante/subscriptions` (`:163`), `GET /api/assistante/subscription-requests` (`:179`), `POST /api/assistante/subscriptions` (`:203`), `PATCH /api/assistante/subscription-requests` (`:229`) |
| `app/dashboard/assistante/subscription-requests/page.tsx` | Redirect (`:13`) → `/dashboard/assistante/subscriptions?tab=requests` | — | — |
| `app/dashboard/assistante/credits/page.tsx` | Student[] avec creditBalance | Add/remove credits | `GET /api/assistante/students/credits` (`:58`), `POST` (`:86`) |
| `app/dashboard/assistante/credit-requests/page.tsx` | CreditRequest[] (student, parent, amount) | Approve/reject | `GET /api/assistante/credit-requests` (`:59`), `POST` (`:79`) |
| `app/dashboard/assistante/paiements/page.tsx` | Payment[] pending (user, amount, method, metadata) | Approve/reject payment | `GET /api/payments/pending` (`:41`), `POST /api/payments/validate` (`:69`) |
| `app/dashboard/assistante/facturation/page.tsx` | (server component `:1-4`, délègue à NexusInvoiceGenerator) | Create Invoice | via `NexusInvoiceGenerator` → `POST /api/admin/invoices` |
| `app/dashboard/assistante/devis/page.tsx` | (server component `:1-4`, iframe vers `/dashboard/assistante/devis/app`) | — | — (iframe) |
| `app/dashboard/assistante/docs/page.tsx` | (server component `:1-5`, lit docs MD/JSON depuis filesystem via `fs.readFile`) | — | — (filesystem) |

### COACH (16 pages)

| Page (fichier) | Lit | Mute | API |
|----------------|-----|------|-----|
| `app/dashboard/coach/page.tsx` | Dashboard cohorte + agenda | — | `GET /api/coach/dashboard`, `GET /api/coach/students/eam-summary` |
| `app/dashboard/coach/students/page.tsx` | Student[] (from dashboard) | — | `GET /api/coach/dashboard` |
| `app/dashboard/coach/eleve/[studentId]/page.tsx` | Student dossier complet | — | `GET /api/coach/students/[id]/dossier` |
| `app/dashboard/coach/sessions/page.tsx` | Today + week sessions | SessionReport (via SessionReportDialog) | `GET /api/coach/dashboard` |
| `app/dashboard/coach/availability/page.tsx` | (via CoachAvailability component) | (via component) | component interne |
| `app/dashboard/coach/stages/page.tsx` | Coach stages, enrolled students | Create/update StageBilan | `GET /api/coach/stages`, `POST /api/stages/[slug]/bilans` |
| `app/dashboard/coach/stages/[slug]/bilan/[id]/page.tsx` | Stage + existing StageBilan | Save/publish StageBilan | `GET /api/coach/stages`, `POST /api/stages/[slug]/bilans` |
| `app/dashboard/coach/npc/page.tsx` | CopySubmission[] (server component) | — | prisma direct |
| `app/dashboard/coach/npc/reports/[reportId]/page.tsx` | PedagogicalReport + CompetenceMatrix + RemediationRoadmap (server) | — | prisma direct |
| `app/dashboard/coach/npc/submissions/[id]/upload/page.tsx` | CopySubmission + pages (server) | File upload (FileUploadZone) | prisma direct |
| `app/dashboard/coach/nsi-pratique-2026/page.tsx` | NSI students progress | — | `GET /api/coach/nsi-pratique-2026/students` |
| `app/dashboard/coach/nsi-pratique-2026/[id]/page.tsx` | NSI student detail | — | `GET /api/coach/nsi-pratique-2026/students/[id]/progress` |
| `app/dashboard/coach/eaf-stage-printemps/page.tsx` | EAF students + bilan status | — | `GET /api/coach/eaf-stage-printemps/students` |
| `app/dashboard/coach/eaf-stage-printemps/[id]/page.tsx` | EAF bilan data | Save/complete/validate/regenerate | `GET/POST/PATCH /api/coach/eaf-stage-printemps/students/[id]/report`, `POST .../regenerate` |
| `app/dashboard/coach/maths-premiere-stage-printemps/page.tsx` | Maths students + bilan status | — | `GET /api/coach/maths-premiere-stage-printemps/students` |
| `app/dashboard/coach/maths-premiere-stage-printemps/[id]/page.tsx` | Maths bilan data | Save/complete/validate/regenerate | `GET/POST/PATCH .../report`, `POST .../regenerate-parent`, `POST .../regenerate-student` |

### PARENT (10 pages, dont 1 redirect)

| Page (fichier) | Lit | Mute | API |
|----------------|-----|------|-----|
| `app/dashboard/parent/page.tsx` | Dashboard (enfants, subscriptions, payments, badges) | — | `GET /api/parent/dashboard` |
| `app/dashboard/parent/children/page.tsx` | Redirect → `/dashboard/parent` | — | — |
| `app/dashboard/parent/enfant/[studentId]/page.tsx` | Child detail (NexusIndex, progression, cohort) | — | `GET /api/parent/dashboard` (filtré) |
| `app/dashboard/parent/stages/page.tsx` | Coach bilans + legacy StageBilans + reservations | — | `GET /api/parent/stages` |
| `app/dashboard/parent/ressources/page.tsx` | UserDocument[] (server component) | — | prisma direct |
| `app/dashboard/parent/factures/page.tsx` | Invoice[] par customerEmail (server component) | — | prisma direct |
| `app/dashboard/parent/paiement/page.tsx` | Pending payment status | Déclarer virement bancaire | `GET /api/payments/check-pending`, `POST /api/payments/bank-transfer/confirm` |
| `app/dashboard/parent/paiement/confirmation/page.tsx` | — (page statique confirmation) | — | — |
| `app/dashboard/parent/abonnements/page.tsx` | Subscriptions, plans, addons, packs | Demander changement plan / addon ARIA | `GET /api/parent/subscriptions`, `POST /api/parent/subscription-requests` |
| `app/dashboard/parent/npc/page.tsx` | CopySubmission[] des enfants (server component) | — | prisma direct |

### ELEVE (17 pages, dont 2 redirects)

| Page (fichier) | Lit | Mute | API |
|----------------|-----|------|-----|
| `app/dashboard/eleve/page.tsx` | Dashboard complet multi-rubrique | — | `GET /api/student/dashboard` |
| `app/dashboard/eleve/sessions/page.tsx` | Redirect → `#sessions` | — | — |
| `app/dashboard/eleve/ressources/page.tsx` | Redirect → `#resources` | — | — |
| `app/dashboard/eleve/documents/page.tsx` | UserDocument[] | — | `GET /api/student/profile`, `GET /api/students/[id]/documents` |
| `app/dashboard/eleve/stages/page.tsx` | Bilans de stage (studentMarkdown) | — | `GET /api/eleve/stages` |
| `app/dashboard/eleve/bilans/[publicShareId]/page.tsx` | Bilan individuel | — | `GET /api/student/bilans/[id]` |
| `app/dashboard/eleve/eam/page.tsx` | (via EAMPrep component) | (via component) | component interne |
| `app/dashboard/eleve/automatismes/page.tsx` | Séries + questions | Tentatives | components internes |
| `app/dashboard/eleve/nsi-pratique-2026/page.tsx` | NSI progress complet | Progress sync | `GET /api/student/dashboard`, `useNsiProgress` hook |
| `app/dashboard/eleve/npc/page.tsx` | CopySubmission[] (server component) | — | prisma direct |
| `app/dashboard/eleve/programme/maths/page.tsx` | Skill graph (filesystem JSON) + QCM bank | — | prisma (academicTrack), filesystem |
| `app/dashboard/eleve/programme/[subject]/page.tsx` | Skill graph par matière | — | prisma (academicTrack), filesystem |
| `app/dashboard/eleve/stage-eam-stmg/page.tsx` | Stage EAM STMG overview (server) | — | prisma (student check) |
| `app/dashboard/eleve/stage-eam-stmg/diagnostic/page.tsx` | Diagnostic EAM STMG (server) | (via component) | prisma |
| `app/dashboard/eleve/stage-eam-stmg/livret/page.tsx` | Livret EAM STMG (server) | (via component) | prisma |
| `app/dashboard/eleve/questionnaires/eaf-stage-printemps/page.tsx` | Draft questionnaire EAF (8 étapes) | Save draft / submit | `GET/POST /api/eleve/questionnaire-eaf-stage-printemps` |
| `app/dashboard/eleve/questionnaires/maths-premiere-stage-printemps/page.tsx` | Draft questionnaire maths (9 étapes) | Save draft / submit | `GET/POST /api/eleve/questionnaire-maths-premiere-stage-printemps` |

### Partagé (2 pages)

| Page | Comportement |
|------|-------------|
| `app/dashboard/page.tsx` | Redirect par rôle |
| `app/dashboard/trajectoire/page.tsx` | Vue trajectoire multi-rôle |

---

## 2. Trous de gestion ADMIN / ASSISTANTE

Chaque absence est prouvée par grep contre le codebase. Format : « grep → EMPTY » signifie 0 résultat pertinent.

### Configuration des règles métier

| Besoin | Preuve d'absence (UI) | Preuve d'absence (API) |
|--------|----------------------|----------------------|
| Modifier les tarifs | `grep -ri 'pricing\|tarif\|price.*config' app/dashboard/admin/` → EMPTY | `grep -ri 'pricing' app/api/admin/` → EMPTY |
| Modifier les règles de groupe | `grep -ri 'group.rules\|group_max' app/dashboard/admin/` → EMPTY | `grep -ri 'group.rules\|group_max' app/api/admin/` → EMPTY |
| Modifier les règles de paiement/remises | (idem — pas de route config) | (idem) |
| Configurer les produits/entitlements | `grep -ri 'entitlement' app/dashboard/admin/` → EMPTY | `grep -ri 'entitlement' app/api/admin/` → résultats uniquement dans `invoices/[id]/route.ts` comme side-effect de MARK_PAID, pas de CRUD dédié |
| Configurer les features/gating | `grep -ri 'features\.ts\|access/features\|FEATURES' app/dashboard/admin/` → EMPTY | `grep -ri 'features\.ts\|access/features' app/api/admin/` → EMPTY |
| Modifier les rate-limit presets | `grep -ri 'rate.limit\|rateLimit' app/dashboard/admin/` → EMPTY | (presets dans `lib/rate-limit/presets.ts`, code TypeScript) |

### CRUD des entités manquantes

| Besoin | Preuve d'absence |
|--------|-----------------|
| ASSISTANTE CRUD Stages (create/edit/delete) | `grep -ri 'stage.*create\|stage.*update\|stage.*delete' app/api/assistante/` → EMPTY. La page `/assistante/stages` (`:75`) fait uniquement `GET /api/assistante/stages` et `POST .../confirm` |
| ADMIN/ASSISTANTE CRUD Subscriptions (create) | `grep -ri 'subscription.*create\|createSubscription' app/api/admin/` → seules les lectures `createdAt`. Le `PUT /api/admin/subscriptions` (`:105` dans la page) ne fait que update status/endDate |
| CRUD Badges (model Badge/StudentBadge) | `grep -ri 'badge\|Badge' app/api/admin/ app/api/assistante/` → EMPTY (hors composant UI `<Badge>`) |
| CRUD PedagogicalContent | `grep -ri 'pedagogicalContent\|PedagogicalContent' app/api/admin/ app/api/assistante/ app/dashboard/admin/ app/dashboard/assistante/` → EMPTY |
| Vue globale documents | `/admin/documents` ne fait qu'upload. Pas de `GET /api/admin/documents` (listing). Pas de vue en tableau |

### Gestion des ressources pédagogiques

| Besoin | Preuve d'absence |
|--------|-----------------|
| Gérer contenus RAG (ChromaDB) | `grep -ri 'rag\|chroma\|embedding\|ingest' app/dashboard/admin/ app/dashboard/assistante/` → seul hit : `assistante/docs/page.tsx` qui DOCUMENTE le pipeline RAG en lecture, ne le gère pas |
| Gérer curriculum data (skill graphs) | Fichiers JSON statiques dans `programmes/generated/` — pas d'UI d'édition |
| Gérer question banks (QCM, diagnostics) | Code TypeScript dans `lib/assessments/questions/`, `lib/survival/qcm-bank.ts` — pas d'UI |
| Gérer définitions diagnostics | Code TypeScript dans `lib/diagnostics/definitions/*.ts` — pas d'UI |

### Supervision & synchronisations

| Besoin | Preuve d'absence |
|--------|-----------------|
| Vue crons (CronExecution) | `grep -ri 'cronExecution\|CronExecution' app/dashboard/ app/api/admin/ app/api/assistante/` → EMPTY |
| Déclenchement manuel cron | Crons dans `lib/cron-jobs.ts`, pas de route admin de déclenchement |
| Vue jobs IA (NPC) pour admin | `grep -ri 'npc\|copySubmission\|aiProcessingJob' app/dashboard/admin/` → EMPTY. Le NPC est visible uniquement par le coach (via `app/dashboard/coach/npc/`) |
| Vue audit logs | `grep -ri 'npcAuditLog\|NpcAuditLog\|audit.*log' app/dashboard/admin/ app/dashboard/assistante/` → EMPTY |
| UI recompute SSN | `grep -ri 'recompute.*ssn' app/dashboard/` → EMPTY. Route `POST /api/admin/recompute-ssn` existe mais aucune page ne l'appelle |
| Supervision ARIA | `grep -ri 'AriaConversation\|AriaMessage' app/dashboard/admin/ app/dashboard/assistante/` → EMPTY (hits `aria-label` sont des attributs HTML, pas le module ARIA) |
| Monitoring rate-limits | `grep -ri 'rate.limit\|rateLimit' app/dashboard/admin/ app/dashboard/assistante/` → EMPTY |

### Facturation avancée

| Besoin | Preuve d'absence |
|--------|-----------------|
| Échéanciers multi-factures | La page facturation (`:269`) crée une facture à la fois. Pas de route batch |
| Relance impayée | Pas de statut OVERDUE dans InvoiceStatus enum (`schema.prisma` : `DRAFT\|SENT\|PAID\|CANCELLED`) |
| Avoirs / remboursements | CGV les prévoit (`lib/cgv-policy.ts`) mais pas d'UI ni de route de crédit note |
| Vue croisée Payment→Invoice | Pas de FK entre les modèles (DOC-2 Signal 4). Pas de vue jointe dans l'UI |
| Réconciliation crédits canonical↔registry | Pas d'affichage comparatif. Triple collision R2 invisible depuis l'UI |

---

## 3. État cible par rôle

> Couche de design/jugement, assumée comme telle. Adossée aux SSOT.

### Principes

1. **SSOT-driven** : chaque écran de configuration lit/écrit dans les SSOT existants
2. **RBAC strict** : ADMIN full access, ASSISTANTE délégation opérationnelle (DOC-4)
3. **Findings résolus** : les dashboards cibles ne perpétuent pas R2/R4/R5/R8
4. **Réconciliation R2** : le dashboard facturation cible fait de la réconciliation canonical↔registry un objet de première classe — **une seule source de crédits par produit**, pas trois nombres divergents

### ADMIN cible

**Conservé** : Dashboard KPIs, Analytics, Activity log, Stages CRUD, Email tests

**Étendu** :
- `/admin/users` : filtres avancés + audit trail
- `/admin/subscriptions` : création directe + lien vers factures
- `/admin/facturation` : **réconciliation canonical↔registry** — pour chaque produit, afficher les crédits PRODUCT_REGISTRY (`lib/entitlement/types.ts`) comme source de vérité, avec alerte si canonical JSON diverge ; vue croisée Payment→Invoice ; échéanciers
- `/admin/documents` : vue globale + filtres

**Nouveau** :
- `/admin/entitlements` : CRUD entitlements actifs par user, lien Invoice source
- `/admin/config/reconciliation` : vue de réconciliation canonical plans ↔ PRODUCT_REGISTRY. Pour chaque plan, afficher côte à côte : crédits annoncés (canonical), crédits octroyés (registry), delta. Source unique = PRODUCT_REGISTRY
- `/admin/crons` : lecture CronExecution (job, dernière exécution, status, erreurs), déclenchement manuel
- `/admin/audit` : vue unifiée NpcAuditLog + Invoice.events
- `/admin/aria` : stats ARIA (conversations, tokens, feedback)
- `/admin/assignments` : vue globale CoachStudentAssignment + détection R5 (coachId orphelins)

### ASSISTANTE cible

**Conservé** : Dashboard, Students CRUD, Coaches CRUD, Assignments, Planning/sessions, Credits/requests, Payments, Subscriptions, Facturation, Devis, Docs

**Étendu** :
- `/assistante/students/[id]` : entitlements actifs, bilans récents, trajectoire
- `/assistante/stages` : CRUD stages complet (create/edit/delete) au lieu de lecture + confirm seuls
- `/assistante/assignments` : warning R5 (records orphelins après assignment ENDED)
- `/assistante/paiements` : afficher le productCode résolu + crédits effectifs (résolution R2 côté validation)

**Nouveau** :
- `/assistante/reservations` : vue consolidée StageReservation avec `richStatus` seul (résolution R4 — ignorer `status` String legacy)
- `/assistante/entitlements` : vue lecture seule (support client)

### COACH cible

**Conservé** : tout le dashboard existant (16 pages)

**Étendu** :
- `/coach/stages/[slug]/bilan/[id]` : migrer de `prisma.stageBilan.upsert` vers `prisma.bilan.create/update` avec `type=STAGE_POST` (convergence Signal 1)
- `/coach/eleve/[id]` : entitlements actifs de l'élève (read-only)

### PARENT cible

**Conservé** : tout le dashboard existant (10 pages)

**Étendu** :
- `/parent/abonnements` : aligner les crédits affichés sur PRODUCT_REGISTRY (source de vérité), pas sur canonical JSON
- `/parent/paiement` : activer le paiement carte (désactivé "Bientôt disponible")

### ELEVE cible

**Conservé** : tout le dashboard existant (17 pages). Pas de changement structurel.

---

## 4. Findings DOC-2 impactant les dashboards

### R2 — Triple collision crédits canonical ↔ registry

**Preuve complète (3 lignes)** :

| Plan | Ligne canonical (`data/pricing.canonical.json`) | credits | Code PRODUCT_REGISTRY (`lib/entitlement/types.ts`) | grantsCredits |
|------|---|:---:|---|:---:|
| ACCES_PLATEFORME | `:1339` | 0 | ABONNEMENT_ESSENTIEL (`:133`) | **4** |
| HYBRIDE | `:1345` | 4 | ABONNEMENT_HYBRIDE (`:142`) | **8** |
| IMMERSION | `:1352` | 8 | ABONNEMENT_IMMERSION (`:151`) | **16** |

Bridge : `resolveProductCode()` dans `app/api/payments/validate/route.ts:41-47`

**Les deux échelles sont mensuelles → le ×2 est un vrai sur-octroi.**

**Impact dashboards** :
- `/admin/facturation` : l'admin crée une facture → MARK_PAID → crédits registry octroyés, non visibles dans l'UI
- `/assistante/paiements` : même collision lors de la validation
- `/parent/abonnements` : crédits annoncés ≠ crédits reçus
- **Cible** : réconciliation canonical↔registry comme objet de première classe (section 3)

### R3 — Float vs Int millimes

Impact : pages facturation (`/admin/facturation` `:269`, `/assistante/facturation`). Conversion TND→millimes côté client.

### R4 — Double statut StageReservation

Impact : `/assistante/stages` (`:88` lit reservations). Cible : afficher `richStatus` seul.

### R5 — coachId non synchronisé

Impact : `/assistante/assignments` (`:249` fait PATCH status=ENDED mais pas de cascade). Cible : afficher records orphelins.

### R8 — StudentReport mort

Vérifié : `grep -ri 'studentReport\|StudentReport' app/dashboard/` → 0 résultats pertinents. Aucune page dashboard ne consomme ce modèle. Suppression sans impact.

---

> **FIN DOC-3 v2** — En attente de validation avant DOC-4.
