# Pré-rentrée 2026 Capacity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter ultérieurement une allocation atomique de 1–4 cohortes sans sixième place ni hold partiel.

**Architecture:** Une interactive transaction Prisma verrouille toutes les cohortes triées par ID, expire/recompte sous verrou puis insère les holds ou affectations. L'idempotence est persistée ; la durée provient d'une politique versionnée obligatoire et reste `OWNER_INPUT_REQUIRED`.

**Tech Stack:** Prisma interactive transactions, PostgreSQL `SELECT ... FOR UPDATE`, TypeScript, Jest multi-connexions.

---

## Source future de politique

**Files future:**

- `lib/stages/v2/policies/seat-hold-policy.ts` : interface/provider/Zod ;
- `data/stages/policies/pre-rentree-2026-seat-hold-policy.json` : créé seulement après décision owner ;
- `lib/stages/v2/policies/load-seat-hold-policy.ts` : loader serveur, jamais frontend.

```ts
type SeatHoldPolicyV1 = {
  schemaVersion: 1;
  policyVersion: string;
  editionCode: 'PRE_RENTREE_2026';
  durationMinutes: number;
  promotionDurationMinutes: number;
};
```

Les deux durées sont `OWNER_INPUT_REQUIRED`. Le loader échoue `SEAT_HOLD_POLICY_MISSING`; aucun fallback et aucune valeur dans composant/route. Le hold persiste l'expiration résolue ; version/durée entrent dans `payloadHash` et l'audit.

## Signature future

```ts
export type AllocateSeatHoldsCommand = {
  enrollmentId: string;
  cohortIds: readonly string[]; // 1..4
  idempotencyKey: string;
  expectedEnrollmentVersion: number;
};

export type AllocateSeatHoldsResult = {
  holds: readonly { id: string; cohortId: string; expiresAt: string }[];
  replayed: boolean;
};

export async function allocateSeatHolds(
  command: AllocateSeatHoldsCommand,
  actor: AuthorizedActor,
  policy: SeatHoldPolicyV1,
): Promise<AllocateSeatHoldsResult>;
```

## Transaction exacte

1. Zod : 1–4 IDs uniques, opaques, triables ; hash de clé/payload avant DB.
2. Trier `cohortIds` par ordre Unicode binaire stable ; ne jamais conserver l'ordre client pour les locks.
3. Démarrer `prisma.$transaction(callback, { isolationLevel: ReadCommitted, maxWait: 5_000, timeout: 10_000 })`.
4. Dans la transaction, fixer `SET LOCAL lock_timeout = '3s'` et obtenir `transaction_timestamp()` depuis PostgreSQL.
5. Verrouiller les cohortes dans une seule requête ordonnée.
6. Charger inscription/modules/variantes sous la même transaction et vérifier version/état/autorisation.
7. Rechercher la clé idempotence : même hash → résultat existant ; hash différent → 409.
8. Passer les holds `ACTIVE` expirés à `EXPIRED`, `releasedAt=nowDb` et auditer.
9. Pour chaque cohorte, compter affectations `CONFIRMED` + holds `ACTIVE` avec `expiresAt > nowDb`.
10. Si une cohorte atteint `maxCapacity`, rollback intégral et `COHORT_FULL` ; aucune des autres ne reçoit de hold.
11. Vérifier variantes et claims planning élève.
12. Insérer tous les holds avec même expiration `nowDb + durationMinutes`, audit minimal et version de policy dans metadata.
13. Commit ; tout effet externe ultérieur passe par outbox lorsque disponible.

SQL de verrouillage paramétré :

```ts
const ids = [...new Set(command.cohortIds)].sort();
const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
  SELECT id
  FROM pre_rentree_cohorts
  WHERE id IN (${Prisma.join(ids)})
  ORDER BY id
  FOR UPDATE
`);
```

Si `rows.length !== ids.length`, retourner `COHORT_NOT_FOUND` sans révéler lequel à un acteur non staff.

## Place consommée

```sql
SELECT
  (SELECT COUNT(*) FROM pre_rentree_cohort_assignments
   WHERE "cohortId" = $1 AND status = 'CONFIRMED')
  +
  (SELECT COUNT(*) FROM pre_rentree_seat_holds
   WHERE "cohortId" = $1 AND status = 'ACTIVE' AND "expiresAt" > transaction_timestamp())
  AS occupied;
```

`PROPOSED`, `TRANSFERRED`, `CANCELLED`, `COMPLETED` et holds terminaux ne consomment pas. L'allocation est interdite si la cohorte n'est plus `FORMING|CONFIRMED` selon la commande autorisée ; une cohorte terminée ne réutilise donc pas ses places historiques.

## Conversion et libération

### Hold → affectation

- verrouiller cohortes triées puis holds triés ;
- vérifier `ACTIVE` et non expiré à `nowDb` ;
- créer/passer assignment `CONFIRMED` ;
- créer les claims élève dans la même transaction M2 ;
- passer hold `CONVERTED`, lier assignment ;
- audit atomique ; paiement tardif ne déclenche jamais ce chemin automatiquement.

### Libération/expiration

- commande explicite : même lock cohorte, `ACTIVE→RELEASED|CANCELLED` ;
- worker futur : sélectionner par index expiry avec `FOR UPDATE SKIP LOCKED`, puis verrouiller cohorte avant transition ;
- le calcul ignore déjà un hold expiré même si le worker n'a pas marqué l'état.

### Liste d'attente différée

Avant `PreRentreeWaitlistEntry`, `COHORT_FULL` est la seule sortie. Après le lot waitlist, la promotion verrouille cohorte puis première entrée `ACTIVE` par priorité/sequence, crée un hold de promotion avec la politique versionnée et change l'entrée dans la même transaction.

## Idempotence

- DB stocke SHA-256 de la clé et hash du payload canonique.
- Unique `(cohortId,idempotencyKeyHash)` + transaction pack.
- Même clé/hash après timeout : retourner les holds existants.
- Même clé/payload différent : `IDEMPOTENCY_CONFLICT`, aucun write.
- Une clé n'est pas réutilisable après expiration pour une nouvelle intention ; nouvelle commande = nouvelle clé.

## Retry et erreurs

| Erreur | Traitement |
|---|---|
| Prisma `P2034`, PostgreSQL `40001`/`40P01` | retry avec jitter, maximum 3, même clé |
| lock timeout/`55P03` | `CAPACITY_BUSY`, aucun retry serveur après maximum |
| `COHORT_FULL` | pas de retry automatique ; waitlist explicite future |
| `SEAT_HOLD_EXPIRED` | nouvelle intention/clé ou réconciliation |
| `IDEMPOTENCY_CONFLICT` | jamais retry |
| timeout client après commit | client répète même clé |

Les valeurs techniques 5 s/10 s/3 s/3 retries appartiennent au transaction helper et sont testées ; elles ne définissent pas la durée métier du hold.

## Démonstration dernière place

État initial : capacité 5, quatre consommateurs. T1 et T2 demandent la cinquième place. T1 obtient le lock ; T2 attend. T1 recompte 4, insère un hold et commit. T2 obtient ensuite le lock, recompte 5 et rollback `COHORT_FULL`. Si T1 rollback, T2 recompte 4 et peut insérer. Toute écriture consommatrice utilise le même lock ; aucun sixième consommateur n'est possible par le service autorisé.

## Tasks/tests

1. Tests unitaires Zod/policy/idempotency hash.
2. Test DB transaction simple capacity 3/4/5.
3. Implémenter lock helper paramétré et test ordre des IDs.
4. Implémenter expire/recount/insert avec tests fail-before-pass.
5. Test 20 PrismaClient concurrents pour dernière place, répété 50 fois en CI dédiée.
6. Test pack quatre cohortes, quatrième pleine : zéro hold.
7. Test timeout après commit/replay, clé divergente, deadlock/retry borné.
8. Test expiration vs conversion et paiement tardif.
9. Test claims élève atomiques après M2.
10. Scan architecture : aucun write direct hold/assignment hors `capacityService`.

**Files future:** `lib/stages/v2/services/capacity-service.ts`, `lib/stages/v2/transactions/lock-cohorts.ts`, `lib/stages/v2/policies/*`, `__tests__/integration/pre-rentree-v2/capacity-concurrency.db.test.ts`.

## Rollback

Flags commandes off, aucune nouvelle allocation, laisser expirer/libérer holds, conserver lignes/audit. Une transaction échouée ne laisse aucun pack partiel. Le rollback applicatif ne redirige jamais une inscription V2 vers `StageReservation` V1.
