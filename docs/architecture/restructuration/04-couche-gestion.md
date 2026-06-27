# DOC-4 — Spec de la couche de gestion admin/assistante (v2)

> Couche design assumée. Base factuelle adossée à DOC-1 (auth corrigée) et DOC-3 §2 (trous prouvés).
> v2 : tier DONNÉES (runtime editable) vs tier LOGIQUE (code). R2 résolu à la racine.
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

## 2. Statique → runtime : deux tiers

### Analyse du couplage code

Avant de trancher, preuve du couplage réel de chaque SSOT :

| SSOT | Le code lit-il les VALEURS via un accessor générique ? | Le code contient-il de la LOGIQUE couplée à des valeurs spécifiques ? |
|------|---|---|
| `pricing.canonical.json` | Oui — `lib/pricing.ts` est un data loader pur. `computeDeposit()` (`:446`) lit `data.rules.payment.deposit_pct` et calcule. Aucune valeur hardcodée. | Non — toutes les fonctions (`computeSchedule`, `applyDiscount`, `applyCarteDiscount`) opèrent sur des paramètres lus du JSON. |
| `PRODUCT_REGISTRY` | Oui — `lib/entitlement/engine.ts` appelle `getProductDefinition(code)` (`:114`) et lit `product.mode`, `product.grantsCredits`, `product.defaultDurationDays`. | Non — `engine.ts` n'a **aucun** code produit hardcodé (`grep 'ABONNEMENT_\|STAGE_\|CREDIT_PACK_\|PREMIUM_\|ARIA_ADDON_' lib/entitlement/engine.ts` → 0 résultats). Le switch sur `product.mode` (SINGLE/EXTEND/STACK) est une logique structurelle, pas une valeur. |
| `FEATURES` | Partiellement — `requires[]` et `label` sont des données pures. Mais `fallback` (HIDE/DISABLE/REDIRECT) et `rolesExempt` contrôlent le comportement UI/sécurité. | Oui — `resolveAccess()` dans `lib/access/rules.ts` utilise `fallback` pour décider du comportement. Modifier `rolesExempt` en runtime = risque de changement de posture sécurité. |
| `RBAC_POLICIES` | Non — `lib/rbac.ts` (565 lignes) contient des rules complexes avec `allowOwner`, callbacks de vérification. | Oui — couplage total entre policy keys et handler logic. |
| `RATE_LIMIT_PRESETS` | Non — les presets définissent les limites ET sont référencés par nom dans chaque route. | Oui — changer un preset en runtime modifie la posture DDoS de toutes les routes qui l'utilisent. |
| `LEGAL` / `CGV` | Données pures. | Non — mais changement = engagement juridique, pas une décision opérationnelle. |
| `GROUP_RULES` | Données pures (duplicate du canonical JSON). | Non — mais à supprimer, pas à migrer (DOC-2). |

### Tier DONNÉES — éditable runtime par ADMIN

Paramètres métier qui sont des **valeurs pures** sans couplage logique au code. Le moteur qui les consomme opère sur des accessors génériques.

| Paramètre | Source actuelle | Preuve de découplage |
|-----------|----------------|---------------------|
| Prix des offres (annuelles, stages, ponctuels, packs) | `pricing.canonical.json` → `getAllOffers()`, `getStageFormats()`, etc. | `lib/pricing.ts` : pure data loader, aucun prix hardcodé |
| Crédits par plan | `pricing.canonical.json` → `operational_subscription_plans.*.credits` | Valeur lue par `getOperationalSubscriptionPlan()` |
| Crédits octroyés par produit | `lib/entitlement/types.ts` → `PRODUCT_REGISTRY.*.grantsCredits` | `engine.ts:114` lit via `getProductDefinition()`, aucun produit hardcodé |
| Durée des entitlements | `PRODUCT_REGISTRY.*.defaultDurationDays` | `computeEndsAt()` dans `types.ts` — pure fonction de la valeur |
| Features par produit | `PRODUCT_REGISTRY.*.features[]` | Tableau de strings, lu par `hasFeature()` |
| Règles de paiement | `pricing.canonical.json` → `rules.payment.deposit_pct`, `installments_default`, `rounding_tnd` | `computeDeposit()` (`:446`), `computeSchedule()` (`:452`) — pures fonctions de ces valeurs |
| Règles de remise | `pricing.canonical.json` → `rules.discounts.*` | `applyDiscount()`, `applyCarteDiscount()` — pures fonctions |
| group_max / group_min_open | `pricing.canonical.json` → `rules.group_max/min_open` | Valeurs lues par `getRules()`, aucune logique couplée |
| Labels et descriptions produits | `PRODUCT_REGISTRY.*.label`, plans `*.name` | Données d'affichage pures |

### Tier LOGIQUE — reste en code, PR + review

Paramètres où le code contient de la **logique couplée** aux valeurs, ou dont la modification impacte la **posture de sécurité**.

| Paramètre | Source actuelle | Preuve du couplage |
|-----------|----------------|-------------------|
| Modes d'activation (SINGLE/EXTEND/STACK) | `PRODUCT_REGISTRY.*.mode` | `engine.ts:134-180` : `if (product.mode === 'SINGLE')` — le moteur switch sur le mode. Ajouter un nouveau mode = nouveau code. Changer le mode d'un produit existant = changement de sémantique d'activation. |
| Feature fallback (HIDE/DISABLE/REDIRECT) | `FEATURES.*.fallback` | `lib/access/rules.ts` : `resolveAccess()` retourne le `fallback` qui contrôle le comportement UI. Changer REDIRECT→HIDE en runtime = modifier la posture d'accès. |
| Feature rolesExempt | `FEATURES.*.rolesExempt` | Modifier `rolesExempt` = changer quels rôles bypassent le gating. Impact sécurité direct. |
| RBAC policies | `lib/rbac.ts` | 565 lignes, `allowOwner` callbacks, vérifications de propriété. Couplage total code↔policies. |
| Rate-limit presets | `lib/rate-limit/presets.ts` | Chaque route référence un preset par nom. Modifier `expensive: { limit: 10 }` → `{ limit: 1000 }` en runtime = désarmer la protection DDoS. |
| Legal / CGV | `lib/legal.ts`, `lib/cgv-policy.ts` | Données juridiques. Pas de couplage code, mais changement = engagement juridique → PR + review légale, pas une UI admin. |

### Mécanisme du store runtime (Tier DONNÉES)

#### Modèle Prisma

```prisma
model BusinessConfig {
  id            String   @id @default(cuid())
  namespace     String   // 'pricing.rules', 'pricing.offers', 'products', 'products.credits'
  key           String   // 'deposit_pct', 'ABONNEMENT_ESSENTIEL.grantsCredits', 'group_max'
  value         Json     // la valeur typée
  schemaVersion String   // version du schéma de validation attendu
  version       Int      @default(1) // auto-incrémenté à chaque écriture
  previousValue Json?    // snapshot avant modification (rollback)
  updatedBy     String   // userId de l'admin
  updatedAt     DateTime @default(now())
  createdAt     DateTime @default(now())

  @@unique([namespace, key])
  @@index([namespace])
  @@index([updatedAt])
  @@map("business_configs")
}
```

#### Mécanisme d'écriture

1. **Validation de schéma** : chaque namespace a un schema Zod déclaré dans `lib/config/schemas.ts`. L'API valide AVANT d'écrire. Exemples :
   - `pricing.rules.deposit_pct` : `z.number().int().min(0).max(100)`
   - `products.ABONNEMENT_ESSENTIEL.grantsCredits` : `z.number().int().min(0).max(100)`
   - `pricing.rules.group_max` : `z.number().int().min(1).max(20)`

2. **Versioning + audit** : chaque écriture incrémente `version`, sauvegarde `previousValue`, enregistre `updatedBy`.

3. **Garde RBAC** : `requireRole(ADMIN)` sur toutes les routes d'écriture config.

4. **Rollback** : `POST /api/admin/config/rollback { namespace, key }` restaure `previousValue`.

#### Mécanisme de lecture (migration progressive)

Les accessors existants (`lib/pricing.ts`, `lib/entitlement/types.ts`) sont modifiés pour lire d'abord le store runtime, puis fallback sur la valeur statique :

```typescript
// lib/config/reader.ts
export async function getConfigValue<T>(namespace: string, key: string, fallback: T): Promise<T> {
  const entry = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace, key } },
    select: { value: true },
  });
  return entry ? (entry.value as T) : fallback;
}
```

Les accessors existants restent la couche d'accès publique. `lib/pricing.ts` → `getRules()` devient :

```typescript
export async function getRules(): Promise<Rules> {
  const staticRules = data.rules;
  return {
    ...staticRules,
    group_max: await getConfigValue('pricing.rules', 'group_max', staticRules.group_max),
    payment: {
      ...staticRules.payment,
      deposit_pct: await getConfigValue('pricing.rules', 'deposit_pct', staticRules.payment.deposit_pct),
    },
    // ... etc
  };
}
```

**Migration progressive** : tant qu'une clé n'a pas d'entrée dans `BusinessConfig`, la valeur statique est utilisée. L'admin peut overrider une valeur à la fois depuis l'UI.

### Résolution R2 à la racine

R2 est causé par deux sources indépendantes de crédits : `pricing.canonical.json` (annoncé) et `PRODUCT_REGISTRY` (octroyé). La source unique runtime est le store `BusinessConfig`.

**Convergence** :
1. Migrer `PRODUCT_REGISTRY.*.grantsCredits` vers le store runtime : namespace `products`, key `ABONNEMENT_ESSENTIEL.grantsCredits`, etc.
2. Migrer `operational_subscription_plans.*.credits` vers le store runtime : namespace `pricing.plans`, key `ACCES_PLATEFORME.credits`, etc.
3. L'écran admin édite les deux sous le même toit. **Une seule valeur de crédits par produit** : le store runtime. L'admin voit et corrige la divergence.
4. `resolveProductCode()` (`app/api/payments/validate/route.ts:36-68`) lit le `grantsCredits` depuis le store runtime, plus depuis le code TS.
5. L'écran marketing (`/parent/abonnements`) lit les crédits depuis le store runtime, plus depuis le canonical JSON.

**L'écran « réconciliation » (§3.1) devient un filet transitoire** : tant que la migration n'est pas complète, il affiche les divergences entre valeurs statiques et store runtime. Quand toutes les valeurs sont en runtime, l'écran se simplifie en une vue de la config courante.

### Résumé des deux tiers

| SSOT | Tier | Mécanisme | ADMIN | ASSISTANTE |
|------|------|-----------|:---:|:---:|
| Prix offres, stages, ponctuels, packs | **DONNÉES** | Store runtime `BusinessConfig` | Éditer | Consulter |
| Crédits par produit (`grantsCredits`) | **DONNÉES** | Store runtime | Éditer | Consulter |
| Durées entitlements (`defaultDurationDays`) | **DONNÉES** | Store runtime | Éditer | Consulter |
| Features par produit (`features[]`) | **DONNÉES** | Store runtime | Éditer | Consulter |
| Règles paiement (acompte, échéancier) | **DONNÉES** | Store runtime | Éditer | Consulter |
| Règles remises | **DONNÉES** | Store runtime | Éditer | Consulter |
| group_max / group_min_open | **DONNÉES** | Store runtime | Éditer | Consulter |
| Labels / descriptions produits | **DONNÉES** | Store runtime | Éditer | Consulter |
| Modes d'activation (SINGLE/EXTEND/STACK) | **LOGIQUE** | Code TS, PR | — | — |
| Feature fallback + rolesExempt | **LOGIQUE** | Code TS, PR | — | — |
| RBAC policies | **LOGIQUE** | Code TS, PR | — | — |
| Rate-limit presets | **LOGIQUE** | Code TS, PR | — | — |
| Legal / CGV | **LOGIQUE** | Code TS, PR | — | — |
| GROUP_RULES (lib/group-rules.ts) | **SUPPRIMER** | Dédupliquer vers canonical/runtime | — | — |

---

## 3. Écrans de gestion

### 3.1 Éditeur de configuration métier (Tier DONNÉES)

**Écran** : `/admin/config`
**Rôle** : ADMIN (édition) / ASSISTANTE (consultation via `/assistante/config`, read-only)

**Onglets** :

#### Onglet Tarifs
- Lit : `BusinessConfig` namespace `pricing.*` avec fallback `pricing.canonical.json`
- Affiche : tableau éditable des prix par offre, stage, pack. Champs validés par schema Zod.
- Mute : `PATCH /api/admin/config` → écrit dans `BusinessConfig` avec version + audit

#### Onglet Produits & Crédits
- Lit : `BusinessConfig` namespace `products.*` avec fallback `PRODUCT_REGISTRY`
- Affiche : 14 produits avec `grantsCredits`, `defaultDurationDays`, `features[]` éditables
- **Résolution R2** : une seule valeur de crédits visible et éditable par produit. L'ancien canonical et l'ancien registry ne sont plus les sources actives.

#### Onglet Règles
- Lit : `BusinessConfig` namespace `pricing.rules.*`
- Affiche : acompte %, échéancier, cap remises, group_max, group_min_open — éditables

#### Onglet Historique
- Lit : `BusinessConfig` ordered by `updatedAt DESC`
- Affiche : journal des modifications (qui, quand, ancienne valeur → nouvelle). Bouton rollback par entrée.

**Contrat API** :
```
GET /api/admin/config?namespace=
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { entries: BusinessConfig[], fallbacks: Record<string, Json> }

PATCH /api/admin/config
Guard: requireRole(ADMIN)
Body: { namespace, key, value: Json }
Validation: Zod schema par namespace (lib/config/schemas.ts)
Response: { entry: BusinessConfig }

POST /api/admin/config/rollback
Guard: requireRole(ADMIN)
Body: { namespace, key }
Response: { entry: BusinessConfig }

GET /api/admin/config/history?namespace=&key=&page=&limit=
Guard: requireRole(ADMIN)
Response: { entries: BusinessConfig[], pagination }
```

### 3.2 Réconciliation transitoire (filet R2)

**Écran** : onglet dans `/admin/config`
**Rôle** : ADMIN seul

Tant que la migration n'est pas complète, affiche côte à côte :
- Valeur statique (canonical JSON / PRODUCT_REGISTRY code TS)
- Valeur runtime (BusinessConfig, si elle existe)
- Delta

Quand toutes les valeurs Tier DONNÉES sont dans le store runtime, cet onglet se simplifie en « config courante ».

### 3.3 Vue entitlements actifs

**Écran** : `/admin/entitlements` (ADMIN CRUD) / `/assistante/entitlements` (read-only)

**Lit** : Entitlement[] avec User + Invoice source

**Mute (ADMIN)** : révoquer, ajuster endsAt

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

### 3.4 Supervision crons

**Écran** : `/admin/crons`
**Rôle** : ADMIN seul

**Lit** : CronExecution[] (3 jobs)
**Mute** : déclencher manuellement

**Contrat API** :
```
GET /api/admin/crons
Guard: requireRole(ADMIN)
Response: { jobs: [{ jobName, lastExecution, history: CronExecution[] }] }

POST /api/admin/crons/trigger
Guard: requireRole(ADMIN)
Body: { jobName }
Response: { execution: CronExecution }
```

### 3.5 Vue audit

**Écran** : `/admin/audit`
**Rôle** : ADMIN seul

**Lit** : NpcAuditLog[] + Invoice.events[] + BusinessConfig history

**Contrat API** :
```
GET /api/admin/audit?type=npc|invoice|config&actorId=&from=&to=&page=&limit=
Guard: requireRole(ADMIN)
Response: { entries: AuditEntry[], pagination }
```

### 3.6 Stats ARIA

**Écran** : `/admin/aria`
**Rôle** : ADMIN seul

**Contrat API** :
```
GET /api/admin/aria/stats
Guard: requireRole(ADMIN)
Response: { totalConversations, bySubject, totalMessages, feedbackPositive, feedbackNegative }
```

### 3.7 Vue globale documents

**Écran** : extension de `/admin/documents`
**Rôle** : ADMIN + ASSISTANTE

**Contrat API** :
```
GET /api/admin/documents?userId=&documentType=&subject=&page=&limit=
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { documents: UserDocument[], pagination }
```

### 3.8 CRUD Stages pour ASSISTANTE

Élargir les guards existants :
```
POST /api/admin/stages → Guard: requireAnyRole(ADMIN, ASSISTANTE)
PATCH /api/admin/stages/[id] → Guard: requireAnyRole(ADMIN, ASSISTANTE)
DELETE reste requireRole(ADMIN)
```

### 3.9 Assignments avec détection R5

Extension : après PATCH status=ENDED, afficher les records orphelins.

```
GET /api/assistante/assignments/[id]/orphans
Guard: requireAnyRole(ADMIN, ASSISTANTE)
Response: { orphanedBilans: [], orphanedSessions: [] }
```

### 3.10 Vue StageReservation unifiée (R4)

Front-only : afficher `richStatus` (enum), ignorer `status` (String legacy). Réutilise les routes existantes.

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
| **Config Tier DONNÉES (read)** | x | x | Consultation — l'assistante doit voir les tarifs, crédits, règles en vigueur. |
| **Config Tier DONNÉES (write)** | x | — | Paramètres métier = décision business, pas opérationnel. L'assistante n'éditera pas un prix ou un nombre de crédits. |
| **Config réconciliation / historique** | x | — | Diagnostic technique — R2, audit. |
| **Crons monitoring** | x | — | Système. |
| **Crons trigger** | x | — | Système — risque de double exécution. |
| **Audit logs** | x | — | Conformité — accès restreint. |
| **ARIA stats** | x | — | Système. |
| **NPC admin view** | x | — | Système — jobs IA, pas opérationnel. |
| **RBAC / features / rate-limits** | x | — | Sécurité critique — pas d'UI, reste en code. |

### Résumé de la frontière

**ASSISTANTE peut** : CRUD élèves/coaches/assignments, create/update stages (pas delete), planifier sessions, gérer crédits/paiements/factures/abonnements-requests, consulter entitlements, consulter la config métier (tarifs, crédits, règles en lecture seule).

**ASSISTANTE ne peut PAS** : CRUD users admin/assistante, delete stages, modifier subscriptions directement, CRUD entitlements, **éditer la config métier** (prix, crédits, règles — Tier DONNÉES en écriture = ADMIN seul), configurer features/RBAC (Tier LOGIQUE), superviser crons/audit/ARIA, assigner coaches aux stages.

**Garde de la frontière** : chaque route de la matrice utilise soit `requireRole(ADMIN)` (ADMIN seul) soit `requireAnyRole(ADMIN, ASSISTANTE)` (délégation). La frontière est enforcée au niveau handler, pas au niveau UI. L'UI peut masquer les boutons, mais la sécurité ne repose pas sur le masquage.

---

> **FIN DOC-4** — En attente de validation avant DOC-5.
