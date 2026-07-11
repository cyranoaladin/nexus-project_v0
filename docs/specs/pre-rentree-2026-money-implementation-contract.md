# Pré-rentrée 2026 — contrat d'implémentation monétaire

## Décision

Tous les montants physiques V2 sont des `Int` Prisma / `INTEGER` PostgreSQL exprimés en millimes, devise `TND`. Aucun champ monétaire V2 n'utilise `Float`, `Decimal` ou `BigInt`.

```text
1 TND = 1 000 millimes
PostgreSQL INTEGER = -2 147 483 648 à 2 147 483 647
Prisma Int PostgreSQL = INTEGER signé 32 bits
Maximum positif physique = 2 147 483,647 TND
```

Le maximum contractuel approuvé par inscription est 1 800 000 millimes, soit environ 0,084 % de la borne positive. `Int` est donc suffisant pour toutes les lignes monétaires V2 proposées. Les agrégations SQL utilisent un type transitoire `bigint`, sans introduire de colonne `BigInt`.

## Valeurs de contrôle

| Pack | Total TND | Total millimes | 30 % brut | Acompte canonique arrondi à 10 TND | Solde |
|---:|---:|---:|---:|---:|---:|
| 1 | 480 | 480 000 | 144 TND | 140 TND / 140 000 | 340 TND / 340 000 |
| 2 | 900 | 900 000 | 270 TND | 270 TND / 270 000 | 630 TND / 630 000 |
| 3 | 1 350 | 1 350 000 | 405 TND | 410 TND / 410 000 | 940 TND / 940 000 |
| 4 | 1 800 | 1 800 000 | 540 TND | 540 TND / 540 000 | 1 260 TND / 1 260 000 |

Les acomptes ne sont jamais des constantes autonomes : les nombres ci-dessus sont des assertions de test de `computeDeposit` et de la conversion centrale. Source : catalogue canonique + règle `round(price × 30 % / 10) × 10`.

## Bornes par champ

| Modèle/champ | Minimum | Maximum métier attendu PRE2026 | Maximum physique | Agrégation/risque |
|---|---:|---:|---:|---|
| `PreRentreeProposal.totalMillimes` | 0 | 1 800 000 | 2 147 483 647 | `SUM` multi-inscriptions retourne `bigint` |
| `depositMillimes` | 0 | 540 000 | 2 147 483 647 | aucun overflow par ligne |
| `balanceMillimes` | 0 | 1 260 000 | 2 147 483 647 | dérivé total−acompte au calcul |
| `PreRentreePayment.expectedMillimes` | 0 | 1 800 000 | 2 147 483 647 | somme paiements `bigint` transitoire |
| `receivedMillimes` | 0 | 1 800 000 normalement | 2 147 483 647 | surpaiement seulement `RECONCILIATION_REQUIRED` |
| `PreRentreeRefund.requestedMillimes` | 0 | paiement encaissé | 2 147 483 647 | cumul sous lock paiement |
| `refundedMillimes` | 0 | montant demandé/encaissé | 2 147 483 647 | somme refunds `bigint` transitoire |
| `Invoice.subtotal/discountTotal/taxTotal/total/paidAmount` existants | 0 | snapshot accepté | 2 147 483 647 | service facture existant, même unité |

Aucun total de cohorte ou d'édition n'est persisté. À capacité 5, le plafond illustratif du pack 4 est 9 000 000 millimes par ensemble de cinq contrats, toujours sous `Int`, mais les rapports utilisent néanmoins `SUM(...)::bigint`.

## Conversions centrales futures

**File future:** `lib/money/millimes.ts` — propriétaire Sol, partagé par pricing/paiement/facture.

```ts
export type TndMillimes = number & { readonly __brand: 'TndMillimes' };

export function assertTndMillimes(value: unknown): TndMillimes;
export function tndIntegerToMillimes(tnd: number): TndMillimes;
export function decimalTndStringToMillimes(value: string): TndMillimes;
export function addMillimes(values: readonly TndMillimes[]): TndMillimes;
export function subtractMillimes(a: TndMillimes, b: TndMillimes): TndMillimes;
export function formatTnd(millimes: TndMillimes, locale?: 'fr-TN'): string;
export function postgresBigIntAggregateToString(value: bigint | string): string;
```

- Entrée `number` acceptée seulement si entière pour les tarifs TND canoniques actuels.
- Une chaîne décimale fournisseur est parsée lexicalement ; aucune multiplication flottante.
- Tout résultat vérifie `Number.isSafeInteger`, `0 <= value <= 2_147_483_647` avant Prisma.
- Les montants individuels DTO sont des `number` entiers millimes + `currency: 'TND'`.
- Les agrégats admin issus de `SUM(INTEGER)` sont sérialisés en chaîne décimale millimes, car PostgreSQL retourne `bigint` et JSON ne sérialise pas `BigInt` natif.
- Comparaison et tri se font en millimes, jamais sur chaîne formatée.
- Affichage est une opération de présentation unique ; aucune page ne divise/multiplie librement par 1 000.

## Schémas Zod futurs

```ts
export const tndMillimesSchema = z.number().int().min(0).max(2_147_483_647);
export const currencyTndSchema = z.literal('TND');
export const moneyDtoSchema = z.object({
  millimes: tndMillimesSchema,
  currency: currencyTndSchema,
}).strict();
export const aggregateMoneyDtoSchema = z.object({
  millimes: z.string().regex(/^\d+$/),
  currency: currencyTndSchema,
}).strict();
```

Les remboursements et ajustements restent des montants positifs avec un `purpose/status` distinct. Aucun montant négatif n'encode un remboursement.

## CHECK constraints M1/M2

```sql
ALTER TABLE pre_rentree_proposals
  ADD CONSTRAINT pre_rentree_proposal_currency_tnd
    CHECK (currency = 'TND'),
  ADD CONSTRAINT pre_rentree_proposal_amounts_nonnegative
    CHECK ("totalMillimes" >= 0 AND "depositMillimes" >= 0 AND "balanceMillimes" >= 0),
  ADD CONSTRAINT pre_rentree_proposal_amounts_balance
    CHECK ("totalMillimes" = "depositMillimes" + "balanceMillimes");
```

Les futurs modèles paiement/remboursement ajouteront :

```sql
CHECK (currency = 'TND');
CHECK ("expectedMillimes" >= 0);
CHECK ("receivedMillimes" IS NULL OR "receivedMillimes" >= 0);
CHECK (
  "receivedMillimes" IS NULL
  OR "receivedMillimes" <= "expectedMillimes"
  OR status = 'RECONCILIATION_REQUIRED'
);
CHECK ("requestedMillimes" >= 0);
CHECK ("refundedMillimes" IS NULL OR "refundedMillimes" >= 0);
CHECK ("refundedMillimes" IS NULL OR "refundedMillimes" <= "requestedMillimes");
```

`remboursements cumulés <= encaissé` est inter-table : transaction sous verrou `PreRentreePayment FOR UPDATE`, somme réussie et insertion, avec test de concurrence. Ce n'est pas un simple `CHECK`.

## Adaptateurs V1

- `Stage.priceAmount Decimal(10,2)` et `Payment/ClicToPayTransaction Float` ne sont jamais écrits par V2.
- Un adaptateur V1→DTO legacy conserve leur sémantique ; aucun backfill en millimes.
- Si un fournisseur V1 alimente ultérieurement un paiement V2, son montant passe par `decimalTndStringToMillimes` et un test de réconciliation explicite.
- Toute devise différente de TND est refusée avant persistance. Un support multi-devise exige un adaptateur et une ADR ; aucune conversion implicite.

## Tests obligatoires

1. quatre totaux, acomptes bruts, acomptes arrondis et soldes ;
2. 0, borne Int, borne+1, négatif, fraction millime, `NaN`, `Infinity` ;
3. parse chaînes `480`, `480.000`, rejet séparateurs ambigus ;
4. somme locale sans dépasser `Number.MAX_SAFE_INTEGER` ;
5. `SUM(INTEGER)` PostgreSQL retourne bigint et DTO string ;
6. surpaiement passe uniquement en réconciliation ;
7. remboursements concurrents ne dépassent pas l'encaissé ;
8. snapshot/facture utilisent exactement les mêmes millimes ;
9. prix client ignoré ;
10. scan d'architecture : aucun `Float` V2 ni conversion `/ 1000` hors module money/formatter.

## Verdict Int/BigInt

`Int` est validé pour chaque champ physique V2. `BigInt` n'est pas recommandé en stockage : il ajouterait une seconde représentation sans besoin métier et compliquerait Prisma/JSON. Seules les agrégations PostgreSQL/TypeScript emploient `bigint` de manière transitoire et sont sérialisées en chaîne.
