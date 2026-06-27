# DOC-4 — Spec de la couche de gestion admin/assistante

> Couche design assumée. Base factuelle adossée à DOC-1 (auth corrigée) et DOC-3 §2 (trous prouvés).
> Date : 2026-06-27

---

## Sommaire

1. [Matrice RBAC entité × action × rôle](#1-matrice-rbac)
2. [Le problème central : statique → runtime](#2-statique--runtime)
3. [Écrans de gestion](#3-écrans-de-gestion)
4. [Délégation ADMIN → ASSISTANTE](#4-délégation-admin--assistante)

---

## 1. Matrice RBAC

Légende :
- **E** = Existe (route DOC-1 citée)
- **C** = À créer
- **—** = Non autorisé pour ce rôle
- **R/W** = read / create / update / delete / configure / trigger

### Entités opérationnelles

| Entité | Action | ADMIN | ASSISTANTE | Route existante (DOC-1) |
|--------|--------|:---:|:---:|---|
| **User** | read | **E** | **E** | `GET /api/admin/users` (CENTRALIZED `requireRole(ADMIN)`) ; `GET /api/admin/users/search` (CENTRALIZED `requireAnyRole(ADMIN)`) |
| | create | **E** | — | `POST /api/admin/users` (CENTRALIZED `requireRole(ADMIN)`) |
| | update | **E** | — | `PATCH /api/admin/users` (CENTRALIZED `requireRole(ADMIN)`) |
| | delete | **E** | — | `DELETE /api/admin/users` (CENTRALIZED `requireRole(ADMIN)`) |
| **Student** | read | **E** | **E** | `GET /api/assistante/students` (CENTRALIZED `requireAnyRole(ADMIN, ASSISTANTE)`) |
| | read detail | **E** | **E** | `GET /api/assistante/students/[id]` (CENTRALIZED `requireAnyRole(ADMIN, ASSISTANTE)`) |
| | create | **E** | **E** | `POST /api/assistante/students` (CENTRALIZED `requireAnyRole(ADMIN, ASSISTANTE)`) |
| | update | **C** | **C** | Pas de PATCH sur `/api/assistante/students/[id]`. La page (`:105`) lit mais ne mute pas le profil. |
| | delete | **C** | — | Pas de DELETE. |
| **CoachProfile** | read | **E** | **E** | `GET /api/assistante/coaches/manage` (INLINE_AUTH `.includes(ADMIN, ASSISTANTE)`) |
| | create | **E** | **E** | `POST /api/assistante/coaches/manage` (INLINE_AUTH `.includes`) |
| | update | **E** | **E** | `PUT /api/assistante/coaches/manage/[id]` (INLINE_AUTH `.includes`) |
| | delete | **E** | **E** | `DELETE /api/assistante/coaches/manage/[id]` (INLINE_AUTH `.includes`) |
| **CoachStudentAssignment** | read | **E** | **E** | `GET /api/assistante/assignments` (CENTRALIZED `requireAnyRole(ADMIN, ASSISTANTE)`) |
| | create | **E** | **E** | `POST /api/assistante/assignments` (CENTRALIZED + RBAC `can()`) |
| | update (end) | **E** | **E** | `PATCH /api/assistante/assignments/[id]` (CENTRALIZED) |
| | delete | — | — | Pas de DELETE — design intentionnel (soft-end via status ENDED) |
| **Subscription** | read | **E** | **E** | `GET /api/admin/subscriptions` (CENTRALIZED ADMIN) ; `GET /api/assistante/subscriptions` (INLINE_AUTH `.includes`) |
| | create | **C** | **C** | Pas de POST dédié. Création implicite uniquement. |
| | update (status/endDate) | **E** | — | `PUT /api/admin/subscriptions` (CENTRALIZED `requireRole(ADMIN)`) |
| | approve request | **E** | **E** | `POST /api/assistante/subscriptions` (INLINE_AUTH `.includes`) |
| **Invoice** | read | **E** | **E** | `GET /api/admin/invoices` (INLINE_AUTH `userRole !== ADMIN && !== ASSISTANTE`) |
| | create | **E** | **E** | `POST /api/admin/invoices` (INLINE_AUTH, même route, ADMIN+ASSISTANTE) |
| | transition (MARK_SENT/PAID/CANCEL) | **E** | **E** | `PATCH /api/admin/invoices/[id]` (INLINE_AUTH `canPerformStatusAction(userRole)` → ADMIN+ASSISTANTE) |
| | send | **E** | **E** | `POST /api/admin/invoices/[id]/send` (INLINE_AUTH ADMIN+ASSISTANTE) |
| **Entitlement** | read | **C** | **C** | Pas de route de lecture dédiée. Entitlements créés comme side-effect de MARK_PAID. |
| | create/suspend | **E** (side-effect) | **E** (side-effect) | Via `activateEntitlements()`/`suspendEntitlements()` dans `app/api/admin/invoices/[id]/route.ts` — pas de CRUD direct. |
| | CRUD direct | **C** | — | Besoin identifié DOC-3 §2 : diagnostiquer R2, révoquer, ajuster. |
| **Stage** | read | **E** | **E** | `GET /api/admin/stages` (CENTRALIZED ADMIN+ASSISTANTE) ; `GET /api/assistante/stages` (CENTRALIZED ADMIN+ASSISTANTE) |
| | create | **E** | **C** | `POST /api/admin/stages` (CENTRALIZED `requireRole(ADMIN)` — ADMIN seulement) |
| | update | **E** | **C** | `PATCH /api/admin/stages/[id]` (CENTRALIZED `requireRole(ADMIN)`) |
| | delete | **E** | — | `DELETE /api/admin/stages/[id]` (CENTRALIZED `requireRole(ADMIN)`) |
| **StageSession** | read | **E** | **E** | `GET /api/admin/stages/[id]/sessions` (CENTRALIZED ADMIN+ASSISTANTE) |
| | create | **E** | **E** | `POST /api/admin/stages/[id]/sessions` (CENTRALIZED ADMIN+ASSISTANTE) |
| | update/delete | **E** | **E** | `PATCH/DELETE /api/admin/stages/[id]/sessions/[sid]` (CENTRALIZED ADMIN+ASSISTANTE) |
| **StageCoach** | assign/remove | **E** | — | `POST/DELETE /api/admin/stages/[id]/coaches` (CENTRALIZED `requireRole(ADMIN)`) |
| **StageReservation** | read | **E** | **E** | `GET /api/stages/[slug]/reservations` (CENTRALIZED ADMIN+ASSISTANTE) |
| | confirm | **E** | **E** | `POST /api/stages/[slug]/reservations/[id]/confirm` (CENTRALIZED ADMIN+ASSISTANTE) |
| **CreditTransaction** | read | **E** | **E** | `GET /api/assistante/students/credits` (INLINE_AUTH `.includes`) |
| | create (grant) | **E** | **E** | `POST /api/assistante/students/credits` (INLINE_AUTH `.includes`) |
| **Payment** | read pending | **E** | **E** | `GET /api/payments/pending` (INLINE_AUTH `.includes(ADMIN, ASSISTANTE)`) |
| | validate | **E** | **E** | `POST /api/payments/validate` (INLINE_AUTH `.includes(ASSISTANTE, ADMIN)`) |
| **UserDocument** | upload | **E** | **E** | `POST /api/admin/documents` (CENTRALIZED ADMIN+ASSISTANTE) |
| | read list | **C** | **C** | Pas de GET listing global. Upload-only. |
| **SessionBooking** | create | **E** | **E** | `POST /api/assistante/sessions` (CENTRALIZED `requireAnyRole(ADMIN, ASSISTANTE)`) ; via planning page |
| | cancel | **E** | **E** | `POST /api/sessions/cancel` (CENTRALIZED `requireAnyRole(ELEVE, COACH, ASSISTANTE)`) |

### Entités de configuration (SSOT)

| Entité | Action | ADMIN | ASSISTANTE | État actuel |
|--------|--------|:---:|:---:|---|
| **Pricing rules** | read | **C** | **C** | Fichier statique `data/pricing.canonical.json` (1470 lignes). Aucune route ni UI. |
| | configure | **C** | — | Voir §2 — décision statique→runtime |
| **PRODUCT_REGISTRY** | read | **C** | **C** | Code TypeScript `lib/entitlement/types.ts` (14 produits). Aucune route ni UI. |
| | configure | **C** | — | Voir §2 |
| **Features/gating** | read | **C** | — | Code TypeScript `lib/access/features.ts`. Aucune route ni UI. |
| | configure | **C** | — | Voir §2 |
| **RBAC policies** | read | **C** | — | Code TypeScript `lib/rbac.ts` (565 lignes). Aucune route ni UI. |
| | configure | — | — | Reste en code — trop critique pour une UI runtime |
| **Rate-limit presets** | read | **C** | — | Code TypeScript `lib/rate-limit/presets.ts`. Aucune route ni UI. |
| | configure | — | — | Reste en code — sécurité critique |

### Entités de supervision

| Entité | Action | ADMIN | ASSISTANTE | État actuel |
|--------|--------|:---:|:---:|---|
| **CronExecution** | read | **C** | — | Modèle existe (`schema.prisma`). Aucune route ni UI. `grep cronExecution app/dashboard/` → EMPTY |
| | trigger | **C** | — | Crons dans `lib/cron-jobs.ts`. Pas de route de déclenchement. |
| **NpcAuditLog** | read | **C** | — | Modèle existe. `grep npcAuditLog app/dashboard/admin/` → EMPTY |
| **AriaConversation/Message** | read stats | **C** | — | `grep AriaConversation app/dashboard/admin/` → EMPTY |
| **AiProcessingJob** | read | **C** | — | Visible coach NPC seulement. Pas de vue admin. |
| **PedagogicalContent** | CRUD | **C** | — | `grep pedagogicalContent app/api/admin/` → EMPTY |

---

## 2. Statique → runtime

### Le problème

Les SSOT qui pilotent le business sont aujourd'hui :
- **Fichier JSON commité** : `data/pricing.canonical.json` (tarifs, règles, offres)
- **Code TypeScript build-time** : `PRODUCT_REGISTRY`, `FEATURES`, `GROUP_RULES`, `RBAC_POLICIES`, `RATE_LIMIT_PRESETS`

« Éditable depuis le dashboard admin » nécessite de migrer chaque SSOT vers un store runtime. Deux architectures possibles :

**Option A — Table DB de config versionnée** :
- Nouveau modèle `ConfigEntry { id, namespace, key, value: Json, version: Int, updatedBy, updatedAt, previousValue: Json }`
- L'accessor (ex: `lib/pricing.ts`) lit depuis la DB avec cache TTL au lieu du fichier JSON
- Avantages : éditable runtime, audit trail, rollback par version
- Coûts : requête DB sur chaque accès pricing (mitigé par cache), migration des 1470 lignes JSON, risque de config corrompue en prod

**Option B — Write-back Git + redéploiement** :
- L'admin édite via UI → l'API écrit dans le fichier JSON → commit Git automatique → webhook CI redéploie
- Avantages : SSOT reste un fichier versionné, diff lisible, rollback = git revert
- Coûts : temps de propagation (commit + deploy ≈ 2-5 min), pas de CI GitHub dans ce projet, complexité opérationnelle

### Décision par SSOT

| SSOT | Nature actuelle | Décision | Justification |
|------|----------------|----------|---------------|
| `pricing.canonical.json` | JSON 1470 lignes, lu par `lib/pricing.ts` | **Consulter uniquement (read-only UI)** | Trop complexe pour édition runtime. 1470 lignes avec règles imbriquées (acomptes, échéanciers, remises conditionnelles). Risque de corruption business critique. Édition via PR Git avec review reste la bonne approche. L'UI admin affiche les tarifs courants et la réconciliation R2. |
| `PRODUCT_REGISTRY` | TypeScript, 14 produits | **Consulter uniquement (read-only UI)** | Lié au code d'activation (`lib/entitlement/engine.ts`). Changer un `grantsCredits` en runtime sans revalider la logique d'activation = risque. L'UI affiche les produits et alerte sur les divergences canonical↔registry (R2). |
| `FEATURES` / `ACCESS_RULES` | TypeScript, 10 features | **Reste en code** | Feature gating est une décision architecturale, pas opérationnelle. Changement = PR. |
| `GROUP_RULES` | TypeScript, 7 lignes | **Supprimer (dédupliquer vers canonical JSON)** | Duplication prouvée DOC-2. Les 4 composants marketing doivent lire `lib/pricing.ts` → `getRules()` au lieu de `lib/group-rules.ts`. |
| `RBAC_POLICIES` | TypeScript, 565 lignes | **Reste en code** | Sécurité critique. Pas d'édition runtime. |
| `RATE_LIMIT_PRESETS` | TypeScript, 38 lignes | **Reste en code** | Sécurité critique. Pas d'édition runtime. |
| `LEGAL` | TypeScript, 75 lignes | **Reste en code** | Rarement modifié (données juridiques). Changement = PR avec review légale. |
| `CGV_POLICY` | TypeScript, 28 lignes | **Reste en code** | Contrat juridique. Changement = PR + validation légale. |

### Résumé

**Aucun SSOT ne migre vers un store runtime.** La complexité et le risque de corruption business critique l'emportent sur la commodité d'une édition UI. Le vrai besoin n'est pas « éditer les tarifs en live » mais :

1. **Consulter** les SSOT depuis l'interface (pricing, products, features) — sans ouvrir le code
2. **Détecter** les incohérences (réconciliation R2 canonical↔registry) — visible, pas cachée
3. **Auditer** les changements (historique Git des SSOT déjà versionné)

La couche admin crée des **vues de consultation + alertes**, pas des formulaires d'édition runtime.

---

## 3. Écrans de gestion

Pour chaque trou prouvé de DOC-3 §2, un écran spécifié.

### 3.1 Réconciliation canonical ↔ registry (R2)

**Écran** : `/admin/config/reconciliation`
**Rôle** : ADMIN seul
**Lit** :
- `data/pricing.canonical.json` → `operational_subscription_plans` (via `lib/pricing.ts` → `getSubscriptionTiers()`)
- `lib/entitlement/types.ts` → `PRODUCT_REGISTRY`
- Bridge : `resolveProductCode()` (`app/api/payments/validate/route.ts:36-68`)

**Affiche** :
- Tableau à 3 colonnes : Plan canonical (nom, prix, crédits annoncés) | Code PRODUCT_REGISTRY (mode, durée, crédits octroyés) | Delta crédits
- Alerte rouge sur chaque ligne où delta ≠ 0
- Triple collision actuelle mise en évidence

**Mute** : rien (read-only). Résolution = PR sur les fichiers sources.

**Contrat API** :
```
GET /api/admin/config/reconciliation
Guard: requireRole(ADMIN)
Response: { plans: [{ planKey, planName, planCredits, productCode, productCredits, delta }] }
```

### 3.2 Vue PRODUCT_REGISTRY

**Écran** : `/admin/config/products`
**Rôle** : ADMIN seul
**Lit** : `PRODUCT_REGISTRY` (14 produits) via nouvelle route

**Affiche** : tableau des 14 produits (code, label, category, mode, duration, grantsCredits, features[])

**Mute** : rien (read-only)

**Contrat API** :
```
GET /api/admin/config/products
Guard: requireRole(ADMIN)
Response: { products: ProductDefinition[] }
```

### 3.3 Vue pricing canonique

**Écran** : `/admin/config/pricing`
**Rôle** : ADMIN seul
**Lit** : `data/pricing.canonical.json` via `lib/pricing.ts`

**Affiche** : offres annuelles, stages, ponctuels, packs, règles (acompte, échéancier, remises, group_max/min_open). Navigation par onglets.

**Mute** : rien (read-only)

**Contrat API** :
```
GET /api/admin/config/pricing
Guard: requireRole(ADMIN)
Response: { rules, annualOffers, stageFormats, ponctuelOffers, packs, subscriptionTiers, ariaAddons }
```

### 3.4 Vue entitlements actifs

**Écran** : `/admin/entitlements` (ADMIN) et `/assistante/entitlements` (ASSISTANTE, read-only)
**Rôle** : ADMIN (CRUD) / ASSISTANTE (read)

**Lit** : Entitlement[] avec User + Invoice source

**Affiche** : tableau filtrable par user/status/productCode. Pour chaque entitlement : productCode, label, status, startsAt, endsAt, sourceInvoiceId (lien cliquable), crédits octroyés.

**Mute (ADMIN uniquement)** :
- Révoquer un entitlement (status → REVOKED)
- Ajuster endsAt (prolonger/raccourcir)

**Contrat API** :
```
GET /api/admin/entitlements?userId=&status=&productCode=&page=&limit=
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { entitlements: Entitlement[], pagination }

PATCH /api/admin/entitlements/[id]
Guard: requireRole(ADMIN)
Body: { status?: 'REVOKED', endsAt?: DateTime, reason: string }
Response: { entitlement: Entitlement }
```

### 3.5 Supervision crons

**Écran** : `/admin/crons`
**Rôle** : ADMIN seul

**Lit** : CronExecution[] (3 jobs : `checkExpiringCredits`, `expireOldCredits`, `allocateMonthlyCredits`)

**Affiche** : dernière exécution par job (status, startedAt, completedAt, error, metadata). Timeline des 10 dernières exécutions.

**Mute** : déclencher un cron manuellement (bouton par job)

**Contrat API** :
```
GET /api/admin/crons
Guard: requireRole(ADMIN)
Response: { jobs: [{ jobName, lastExecution: CronExecution, history: CronExecution[] }] }

POST /api/admin/crons/trigger
Guard: requireRole(ADMIN)
Body: { jobName: string }
Response: { execution: CronExecution }
```

### 3.6 Vue audit

**Écran** : `/admin/audit`
**Rôle** : ADMIN seul

**Lit** :
- NpcAuditLog[] (actions NPC : validation, feedback, génération)
- Invoice.events[] (audit trail facturation : STATUS_CHANGED, ENTITLEMENTS_ACTIVATED, TOKENS_REVOKED)

**Affiche** : journal unifié filtrable par type (NPC/facturation), acteur, date, entité

**Contrat API** :
```
GET /api/admin/audit?type=npc|invoice&actorId=&from=&to=&page=&limit=
Guard: requireRole(ADMIN)
Response: { entries: AuditEntry[], pagination }
```

### 3.7 Stats ARIA

**Écran** : `/admin/aria`
**Rôle** : ADMIN seul

**Lit** : AriaConversation (count, par subject), AriaMessage (count, feedback stats)

**Affiche** : nombre de conversations par matière, volume de messages, taux de feedback positif/négatif, tokens consommés (si tracé)

**Mute** : rien (read-only)

**Contrat API** :
```
GET /api/admin/aria/stats
Guard: requireRole(ADMIN)
Response: { totalConversations, bySubject: {}, totalMessages, feedbackPositive, feedbackNegative }
```

### 3.8 Vue globale documents

**Écran** : extension de `/admin/documents`
**Rôle** : ADMIN + ASSISTANTE

**Lit** : UserDocument[] (all, filtrable par user/type/subject/date)

**Contrat API** :
```
GET /api/admin/documents?userId=&documentType=&subject=&page=&limit=
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { documents: UserDocument[], pagination }
```

### 3.9 CRUD Stages pour ASSISTANTE

**Écran** : extension de `/assistante/stages`
**Rôle** : ASSISTANTE

**Mute** : Create/Update Stage (les routes `/api/admin/stages` existent déjà, il faut élargir le guard)

**Changement API** :
```
POST /api/admin/stages
Guard actuel: requireRole(ADMIN)
Guard cible: requireAnyRole(ADMIN, ASSISTANTE)

PATCH /api/admin/stages/[id]
Guard actuel: requireRole(ADMIN)
Guard cible: requireAnyRole(ADMIN, ASSISTANTE)
```
Note : DELETE Stage reste ADMIN seul (irréversible).

### 3.10 Assignments avec détection R5

**Écran** : extension de `/assistante/assignments`
**Rôle** : ADMIN + ASSISTANTE

**Ajout** : après un PATCH status=ENDED, afficher les records orphelins (Bilan, SessionBooking avec le coachId de l'assignment terminé).

**Contrat API** :
```
GET /api/assistante/assignments/[id]/orphans
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { orphanedBilans: { id, subject, createdAt }[], orphanedSessions: { id, scheduledDate }[] }
```

### 3.11 Vue StageReservation unifiée (R4)

**Écran** : `/assistante/reservations`
**Rôle** : ASSISTANTE

**Lit** : StageReservation[] — affiche `richStatus` (enum) uniquement, ignore `status` (String legacy)

**Contrat API** : réutilise `GET /api/stages/[slug]/reservations` existant. Côté front, filter/display uniquement sur `richStatus`.

---

## 4. Délégation ADMIN → ASSISTANTE

### Principe

L'ASSISTANTE gère le **quotidien opérationnel** : élèves, coaches, sessions, facturation, stages. L'ADMIN garde le **contrôle système** : configuration, sécurité, audit, utilisateurs admin/assistante.

### Frontière explicite

| Domaine | ADMIN | ASSISTANTE | Justification |
|---------|:---:|:---:|---|
| **CRUD Users (tous rôles)** | x | — | Seul l'ADMIN peut créer/modifier des ADMIN et ASSISTANTE. Risque d'escalade de privilèges. |
| **CRUD Students** | x | x | Opérationnel — inscription, profils. |
| **CRUD Coaches** | x | x | Opérationnel — onboarding coaches. |
| **CRUD Assignments** | x | x | Opérationnel — affecter coach↔élève. |
| **CRUD Stages** | x | **x (create/update)** | Opérationnel — planification stages. DELETE reste ADMIN (irréversible). |
| **Stage Sessions** | x | x | Opérationnel — planification sessions. |
| **Stage Coaches assignment** | x | — | Stratégique — qui enseigne quoi. Garde `requireRole(ADMIN)` actuelle. |
| **StageReservation confirm** | x | x | Opérationnel — valider inscriptions. |
| **Sessions (create/cancel)** | x | x | Opérationnel — planning quotidien. |
| **Credits (grant/revoke)** | x | x | Opérationnel — ajustements. |
| **Credit requests** | x | x | Opérationnel — valider demandes parents. |
| **Payments validation** | x | x | Opérationnel — valider virements. |
| **Invoice CRUD + transitions** | x | x | Opérationnel — facturation. Déjà autorisé (ADMIN+ASSISTANTE). |
| **Subscriptions (update status)** | x | — | `requireRole(ADMIN)` actuel. Changement d'état abo = décision business. |
| **Subscription requests (approve)** | x | x | Opérationnel — valider demandes. |
| **Documents upload** | x | x | Opérationnel. |
| **Documents listing** | x | x | Support. |
| **Entitlements read** | x | x | Support — consulter les droits d'accès d'un élève. |
| **Entitlements CRUD** | x | — | Critique — modifier les droits = impact accès. ADMIN seul. |
| **Config pricing (read)** | x | x | Consultation — l'assistante doit voir les tarifs en vigueur. |
| **Config products (read)** | x | — | Technique — peu utile pour l'opérationnel. |
| **Config reconciliation** | x | — | Diagnostic technique — R2. |
| **Crons monitoring** | x | — | Système. |
| **Crons trigger** | x | — | Système — risque de double exécution. |
| **Audit logs** | x | — | Conformité — accès restreint. |
| **ARIA stats** | x | — | Système. |
| **NPC admin view** | x | — | Système — jobs IA, pas opérationnel. |
| **RBAC / features / rate-limits** | x | — | Sécurité critique — pas d'UI, reste en code. |

### Résumé de la frontière

**ASSISTANTE peut** : CRUD élèves/coaches/assignments, create/update stages (pas delete), planifier sessions, gérer crédits/paiements/factures/abonnements-requests, consulter entitlements et tarifs.

**ASSISTANTE ne peut PAS** : CRUD users admin/assistante, delete stages, modifier subscriptions directement, CRUD entitlements, configurer produits/features/RBAC, superviser crons/audit/ARIA, assigner coaches aux stages.

**Garde de la frontière** : chaque route de la matrice utilise soit `requireRole(ADMIN)` (ADMIN seul) soit `requireAnyRole(ADMIN, ASSISTANTE)` (délégation). La frontière est enforcée au niveau handler, pas au niveau UI. L'UI peut masquer les boutons, mais la sécurité ne repose pas sur le masquage.

---

> **FIN DOC-4** — En attente de validation avant DOC-5.
