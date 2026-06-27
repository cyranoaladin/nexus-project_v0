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

#### Mécanisme de lecture : snapshot mémoire

**Contrainte critique** : les 46 importeurs de `lib/pricing.ts` appellent `getRules()`, `getAllOffers()`, `computeDeposit()`, etc. de manière **synchrone** (vérifié : `grep 'export function\|export async function' lib/pricing.ts` → 0 async). Les passer en async casserait 46 sites d'appel, créerait un fanout DB par requête sur les chemins chauds (pages offres, facturation), et rendrait le pricing indisponible si la DB tombe.

**Solution : snapshot mémoire avec invalidation**

```typescript
// lib/config/snapshot.ts

/** In-memory snapshot of BusinessConfig overrides. Loaded once, refreshed on write or TTL. */
let snapshot: Map<string, Json> = new Map();
let lastLoadedAt = 0;
const TTL_MS = 60_000; // 1 minute

/** Load all BusinessConfig entries into memory. Called at startup + on invalidation. */
export async function loadConfigSnapshot(): Promise<void> {
  const entries = await prisma.businessConfig.findMany({
    select: { namespace: true, key: true, value: true },
  });
  const next = new Map<string, Json>();
  for (const e of entries) {
    next.set(`${e.namespace}::${e.key}`, e.value);
  }
  snapshot = next;
  lastLoadedAt = Date.now();
}

/** Sync read from snapshot. Returns override if exists, otherwise undefined. */
export function getOverride<T>(namespace: string, key: string): T | undefined {
  // Lazy refresh if TTL expired (non-blocking — uses stale snapshot until next request)
  if (Date.now() - lastLoadedAt > TTL_MS) {
    loadConfigSnapshot().catch(console.error); // fire-and-forget
  }
  const val = snapshot.get(`${namespace}::${key}`);
  return val !== undefined ? (val as T) : undefined;
}

/** Invalidate snapshot (called after admin write). */
export async function invalidateConfigSnapshot(): Promise<void> {
  await loadConfigSnapshot();
}
```

**Intégration dans les accessors existants** — les signatures restent SYNC, zéro changement pour les 46 importeurs :

```typescript
// lib/pricing.ts — modifié
import { getOverride } from '@/lib/config/snapshot';

export function getRules(): Rules {
  const staticRules = data.rules;
  return {
    ...staticRules,
    group_max: getOverride<number>('pricing.rules', 'group_max') ?? staticRules.group_max,
    payment: {
      ...staticRules.payment,
      deposit_pct: getOverride<number>('pricing.rules', 'deposit_pct') ?? staticRules.payment.deposit_pct,
      installments_default: getOverride<number>('pricing.rules', 'installments_default') ?? staticRules.payment.installments_default,
      rounding_tnd: getOverride<number>('pricing.rules', 'rounding_tnd') ?? staticRules.payment.rounding_tnd,
    },
    discounts: {
      ...staticRules.discounts,
      global_cap_pct: getOverride<number>('pricing.rules', 'global_cap_pct') ?? staticRules.discounts.global_cap_pct,
      // ... idem pour chaque champ discount
    },
  };
}
```

**Cycle de vie** :
1. **Démarrage** : `loadConfigSnapshot()` appelé dans l'instrumentation Next.js (`instrumentation.ts`) ou le premier appel
2. **Lecture** : `getOverride()` est SYNC, lit le `Map` en mémoire. Si TTL expiré, lance un refresh non-bloquant.
3. **Écriture ADMIN** : `POST /api/admin/config` écrit en DB → appelle `invalidateConfigSnapshot()` → snapshot rafraîchi immédiatement
4. **Panne DB** : le snapshot mémoire reste valide (dernière version chargée). Si jamais le snapshot est vide (premier démarrage, DB down), les fallbacks statiques prennent le relais (opérateur `??`).

**Aucun changement de signature** sur les 46 importeurs de `lib/pricing.ts`, `lib/entitlement/types.ts`, `lib/operational-catalog.ts`.

#### Intégration dans le PRODUCT_REGISTRY

```typescript
// lib/entitlement/types.ts — modifié
import { getOverride } from '@/lib/config/snapshot';

export function getProductDefinition(code: ProductCode): ProductDefinition {
  const staticDef = PRODUCT_REGISTRY[code];
  return {
    ...staticDef,
    grantsCredits: getOverride<number>('products', `${code}.grantsCredits`) ?? staticDef.grantsCredits,
    defaultDurationDays: getOverride<number>('products', `${code}.defaultDurationDays`) ?? staticDef.defaultDurationDays,
    features: getOverride<string[]>('products', `${code}.features`) ?? staticDef.features,
    label: getOverride<string>('products', `${code}.label`) ?? staticDef.label,
    // mode reste statique (Tier LOGIQUE)
  };
}
```

### R2 : rendu corrigible à la source

R2 est causé par deux sources indépendantes de crédits : `pricing.canonical.json` (annoncé) et `PRODUCT_REGISTRY` (octroyé). Le store `BusinessConfig` **rend la source unique POSSIBLE** — il ne résout pas R2 automatiquement.

**Correction effective** = deux étapes :
1. **Décision métier** : quelle échelle de crédits fait foi ? (0/4/8 du canonical ? ou 4/8/16 du registry ? ou une troisième ?) — décision humaine, pas technique.
2. **Saisie admin** : l'admin pose la valeur correcte dans `BusinessConfig` (namespace `products`, key `ABONNEMENT_ESSENTIEL.grantsCredits` = la valeur décidée).

**Tant qu'aucune valeur n'est dans le store** : le fallback `??` octroie la valeur `PRODUCT_REGISTRY` statique actuelle (4/8/16). Le comportement prod ne change pas tant que l'admin n'agit pas.

**L'écran réconciliation (§3.2) est un filet transitoire** qui affiche les divergences et guide la saisie. Quand l'admin a posé toutes les valeurs, les fallbacks statiques ne servent plus et la réconciliation se simplifie en vue de la config courante.

### Validation structurelle : invariants croisés par namespace

Les schemas Zod ne valident pas seulement des champs isolés (min/max). Pour les namespaces à contraintes inter-champs, des invariants croisés sont requis.

#### Namespace `pricing.rules.payment`

**Invariants** (source : `lib/pricing.ts:446-462`, `computeDeposit` + `computeSchedule`) :

| Invariant | Expression | Raison |
|-----------|-----------|--------|
| Deposit cohérent avec installments | `deposit_pct + (100 - deposit_pct)` réparti en `installments_default` versements doit couvrir 100% du prix | `computeSchedule()` (`:452`) : `remaining = price - deposit`, divisé en `n` versements. Si `deposit_pct > 100` → deposit > prix. |
| Rounding ne crée pas de deposit nul | `rounding_tnd` ne doit pas être supérieur au deposit minimum plausible | `computeDeposit()` (`:447`) : `Math.round(price * pct / 100 / rounding) * rounding`. Si `rounding_tnd = 1000` et `price = 150` → deposit = 0. |
| deposit_pct ∈ [0, 100] | Contrainte de domaine | Sinon deposit > prix ou négatif |
| installments_default ≥ 1 | Au moins 1 versement | Sinon division par zéro dans `computeSchedule()` |

```typescript
// lib/config/schemas.ts — namespace pricing.rules.payment
const paymentRulesSchema = z.object({
  deposit_pct: z.number().int().min(0).max(100),
  installments_default: z.number().int().min(1).max(24),
  rounding_tnd: z.number().int().min(1).max(100),
}).refine(
  (d) => {
    // Invariant: avec le prix minimum plausible (150 TND),
    // le deposit arrondi ne doit pas être nul
    const minPrice = 150; // prix minimum existant (ACCES_PLATEFORME)
    const deposit = Math.round((minPrice * d.deposit_pct) / 100 / d.rounding_tnd) * d.rounding_tnd;
    return deposit > 0 || d.deposit_pct === 0;
  },
  { message: 'deposit_pct + rounding_tnd produirait un acompte nul pour le prix minimum (150 TND)' }
);
```

#### Namespace `pricing.rules.discounts`

**Invariants** (source : `lib/pricing.ts`, `applyDiscount`, `applyCarteDiscount`) :

| Invariant | Expression | Raison |
|-----------|-----------|--------|
| global_cap_pct ≥ chaque remise individuelle | `global_cap_pct >= max(comptant_pct, fratrie_2nd_child_pct, ancien_eleve_max_pct, carte_nexus_pct)` | Sinon le cap est inférieur à une remise individuelle → contradiction |
| ancien_eleve_min_pct ≤ ancien_eleve_max_pct | Cohérence plage | |
| parrainage_min_tnd ≤ parrainage_max_tnd | Cohérence plage | |
| global_cap_pct ∈ [0, 50] | Au-delà de 50% le prix plancher est probablement violé | |

```typescript
const discountRulesSchema = z.object({
  comptant_pct: z.number().min(0).max(50),
  fratrie_2nd_child_pct: z.number().min(0).max(50),
  ancien_eleve_min_pct: z.number().min(0).max(50),
  ancien_eleve_max_pct: z.number().min(0).max(50),
  parrainage_min_tnd: z.number().min(0),
  parrainage_max_tnd: z.number().min(0),
  carte_nexus_pct: z.number().min(0).max(50),
  global_cap_pct: z.number().min(0).max(50),
}).refine(
  (d) => d.ancien_eleve_min_pct <= d.ancien_eleve_max_pct,
  { message: 'ancien_eleve_min_pct doit être ≤ ancien_eleve_max_pct' }
).refine(
  (d) => d.parrainage_min_tnd <= d.parrainage_max_tnd,
  { message: 'parrainage_min_tnd doit être ≤ parrainage_max_tnd' }
).refine(
  (d) => d.global_cap_pct >= Math.max(d.comptant_pct, d.fratrie_2nd_child_pct, d.ancien_eleve_max_pct, d.carte_nexus_pct),
  { message: 'global_cap_pct doit être ≥ chaque remise individuelle' }
);
```

#### Namespace `products.*.grantsCredits`

**Invariants** :

| Invariant | Expression | Raison |
|-----------|-----------|--------|
| grantsCredits ≥ 0 | Non négatif | On n'octroie pas de crédits négatifs |
| Si mode = STACK et grantsCredits = null → incohérent | Credit packs DOIVENT octroyer des crédits | `engine.ts:114` : crédits accumulés pour mode STACK |
| Cohérence avec credit_costs | grantsCredits ≥ credit_cost d'une session pour les abonnements | Sinon l'abonnement ne couvre même pas 1 session |

```typescript
const productCreditsSchema = z.number().int().min(0).max(100);
// Invariant cross-product: pas validable par champ seul,
// validé au niveau de l'écran admin qui affiche le coût d'une session
// à côté des crédits octroyés (information, pas blocage)
```

#### Namespace `pricing.rules.group`

**Invariants** :

| Invariant | Expression | Raison |
|-----------|-----------|--------|
| group_min_open.* ≤ group_max pour chaque catégorie | Sinon un groupe ne peut jamais ouvrir | |
| group_max ≥ 1 | Au moins 1 élève | |

```typescript
const groupRulesSchema = z.object({
  group_max: z.number().int().min(1).max(20),
  group_min_open: z.record(z.number().int().min(1)),
}).refine(
  (d) => Object.values(d.group_min_open).every(min => min <= d.group_max),
  { message: 'chaque group_min_open doit être ≤ group_max' }
);
```

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
