# Entitlement Engine — Documentation

## Règles métier canoniques

### Payeur vs Bénéficiaire

| Champ | Rôle | Exemple |
|-------|------|---------|
| `Invoice.customerEmail` | **Payeur** (parent, entreprise) | `parent@example.com` |
| `Invoice.beneficiaryUserId` | **Bénéficiaire** (élève, parfois parent) | `cuid` du User |

**Règle absolue** : aucun entitlement n'est créé sans `beneficiaryUserId`.
Si absent → `ENTITLEMENTS_SKIPPED` event avec `reason: "no_beneficiary"`.

### Modes d'activation

Chaque produit dans `PRODUCT_REGISTRY` a un `mode` qui contrôle le comportement lors d'un second achat :

| Mode | Comportement | Produits |
|------|-------------|----------|
| `SINGLE` | Noop si déjà actif (pas de double activation) | PREMIUM_LITE, PREMIUM_FULL, stages |
| `EXTEND` | Prolonge `endsAt` depuis la fin actuelle (pas depuis now) | Abonnements, ARIA add-ons |
| `STACK` | Toujours créer un nouvel entitlement + accumuler crédits | Credit packs |

### Exemples concrets

**SINGLE** — `PREMIUM_LITE` payé 2 fois :
- 1er paiement → entitlement créé (365j)
- 2e paiement → noop (déjà actif), pas de double activation

**EXTEND** — `ABONNEMENT_ESSENTIEL` payé 2 fois :
- 1er paiement → entitlement créé (30j, fin = J+30)
- 2e paiement → `endsAt` prolongé de 30j (fin = J+60), pas 2 entitlements concurrents

**STACK** — `CREDIT_PACK_10` acheté 2 fois :
- 1er paiement → entitlement créé, +10 crédits
- 2e paiement → nouvel entitlement créé, +10 crédits (total = 20)

### Idempotence

L'activation est idempotente par `sourceInvoiceId` :
- Si un entitlement existe déjà pour le même `(userId, productCode, sourceInvoiceId)` → skip
- Cela protège contre les double-appels (retry, race condition)

### Crédits

- Source de vérité : `Student.credits` (compteur simple)
- L'entitlement garde une trace (`metadata.credits`) pour audit
- Crédits ajoutés **uniquement** quand entitlements réellement créés (pas sur noop)
- Crédits ajoutés **exactement une fois par invoice** (idempotence via sourceInvoiceId)

## Événements d'audit

| Event | Quand | Details |
|-------|-------|---------|
| `ENTITLEMENTS_ACTIVATED` | MARK_PAID + ≥1 activation | `{ created, extended, credits, codes }` |
| `ENTITLEMENTS_SKIPPED` | MARK_PAID + 0 activations | `{ reason, skippedItems }` |
| `ENTITLEMENTS_SUSPENDED` | CANCEL + ≥1 suspension | `{ suspended, codes }` |

Tous les détails sont flat JSON-safe (pas d'objets imbriqués, pas de PII).

## Product Registry

14 produits définis dans `lib/entitlement/types.ts` :

| Code | Catégorie | Mode | Durée | Crédits | Features |
|------|-----------|------|-------|---------|----------|
| STAGE_MATHS_P1 | stage | SINGLE | 90j | — | stage_maths_p1 |
| STAGE_MATHS_P2 | stage | SINGLE | 90j | — | stage_maths_p2 |
| STAGE_NSI_P1 | stage | SINGLE | 90j | — | stage_nsi_p1 |
| STAGE_NSI_P2 | stage | SINGLE | 90j | — | stage_nsi_p2 |
| PREMIUM_LITE | premium | SINGLE | 365j | — | ai_feedback, priority_support |
| PREMIUM_FULL | premium | SINGLE | 365j | — | ai_feedback, priority_support, advanced_analytics, unlimited_sessions |
| ABONNEMENT_ESSENTIEL | abonnement | EXTEND | 30j | 4 | platform_access |
| ABONNEMENT_HYBRIDE | abonnement | EXTEND | 30j | 8 | platform_access, hybrid_sessions |
| ABONNEMENT_IMMERSION | abonnement | EXTEND | 30j | 16 | platform_access, hybrid_sessions, immersion_mode |
| CREDIT_PACK_5 | credits | STACK | ∞ | 5 | — |
| CREDIT_PACK_10 | credits | STACK | ∞ | 10 | — |
| CREDIT_PACK_20 | credits | STACK | ∞ | 20 | — |
| ARIA_ADDON_MATHS | addon | EXTEND | 30j | — | aria_maths |
| ARIA_ADDON_NSI | addon | EXTEND | 30j | — | aria_nsi |

## Migration

### Fichier

`prisma/migrations/20260216_add_entitlement_engine/migration.sql`

### Application en staging/production

```bash
# 1. Vérifier l'état des migrations
npx prisma migrate status

# 2. Appliquer (sans reset, sans prompt)
npx prisma migrate deploy

# 3. Si drift détecté (tables créées manuellement avant migration)
npx prisma migrate resolve --applied 20260216_add_entitlement_engine
```

### Rollback (si nécessaire)

```sql
-- Supprimer la table entitlements
DROP TABLE IF EXISTS "entitlements";

-- Supprimer l'enum
DROP TYPE IF EXISTS "EntitlementStatus";

-- Retirer les colonnes ajoutées
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "beneficiaryUserId";
ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "productCode";
```

## Architecture

```
Invoice (MARK_PAID)
    ↓ $transaction atomique
InvoiceItem.productCode → PRODUCT_REGISTRY lookup
    ↓ mode-aware activation
    ├── SINGLE: noop if active
    ├── EXTEND: prolong endsAt
    └── STACK:  create + credits
    ↓
Student.credits += grantsCredits
    ↓
ENTITLEMENTS_ACTIVATED event (audit trail)
```

```
Invoice (CANCEL)
    ↓ $transaction atomique
Entitlement.updateMany(status → SUSPENDED)
    ↓
ENTITLEMENTS_SUSPENDED event (audit trail)
```
