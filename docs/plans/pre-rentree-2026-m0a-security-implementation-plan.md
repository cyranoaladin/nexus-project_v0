# Pré-rentrée 2026 M0A-R — Security Review and Gap Closure

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are explicitly authorized) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer `GATE-SEC-BASE-001` de `IMPLEMENTED_ON_MAIN_PENDING_DEDICATED_REVIEW` à `VERIFIED_IN_TEST` sans exposer de route V2 et sans régresser V1.

**Architecture:** Le socle de sécurité (guards, ownership, IDOR, documents, factures, webhook) est désormais présent sur main suite à la fusion de G-SEC/G-PAY. M0A-R vérifie ce socle pour les exigences Pré-rentrée, ferme les écarts démontrés, et déclare les types V2 en DENY par défaut sans ouvrir de route.

**Tech Stack:** NextAuth 5 beta, Next.js Route Handlers, TypeScript, Zod, Prisma 6.19.2, Jest, PostgreSQL 15.

---

### Supersession — 2026-07-11

> Ce plan remplace la version originale qui décrivait M0A comme une implémentation
> générale du socle de sécurité à partir de zéro. Depuis :
>
> - G-SEC fusionné (`b2ea32f0b`) : guards, IDOR bilans, document download RBAC,
>   audit script, parseJsonBody, date validation, pre-commit hook, seed guard
> - G-PAY fusionné (`ac02f548b`) : webhook HMAC-SHA256 + timingSafeEqual,
>   init guard, fail-closed 501, PaymentMethodsNote
> - Post-merge (`c90b142c8`) : matrice P0=0/P1=2, POST-MERGE-CHORES tracker
>
> Réconciliation complète : [`2026-07-pre-rentree-current-main-security-reconciliation.md`](../audits/2026-07-pre-rentree-current-main-security-reconciliation.md)

## État observé (après réconciliation)

- `origin/main` vaut `c90b142c88d69bdc600f3f848b44ca0317c00242` et contient les hardenings G-SEC/G-PAY fusionnés.
- `lib/guards.ts` fournit `requireAuth`, `requireRole`, `requireAnyRole`, `isErrorResponse`, `isOwner`, `isStaff`, et des guards de propriété (parent, coach, student, invoice).
- `lib/api/helpers.ts` fournit `parseJsonBody` avec discrimination empty/malformed.
- `lib/documents/storage-root.ts` centralise le chemin de stockage.
- `lib/invoice/not-found.ts` fournit `buildInvoiceAccessWhere` et `notFoundResponse` (404 sans fuite).
- `lib/validation/common.ts` fournit `civilDateSchema` et `strictDateSchema` avec round-trip.
- Route download documents avec RBAC complet, realpath, containment, nosniff, no-store.
- Webhook ClicToPay avec HMAC-SHA256, timingSafeEqual, secret-first, fail-closed 501.
- Init ClicToPay avec requireAnyRole + Zod + fail-closed.
- Script audit guards : P0=0, P1=2 (assessments/submit, webhook business logic).
- Les helpers parent V1 utilisent `Student.parentId`; la V2 devra utiliser `PreRentreeGuardianRelationship` après M3.
- Le coach V1 est porté par `CoachStudentAssignment`; la V2 devra vérifier `PreRentreeTeacherAssignment`.
- La branche locale `g-sec/api-guards` est désormais obsolète comme référence : ses apports sont sur main.

## Inventaire de routes — état actuel

L'inventaire est désormais présent sur main via `docs/security/API_GUARD_INVENTORY.md` (176 routes, P0=0, P1=2) et le script `scripts/security/audit-api-guards.mjs`.

| Famille | Chemins | Statut sur main |
|---|---|---|
| Stage public | `app/api/stages/**` | PUBLIC_BY_DESIGN (inscrire) + P2 |
| Stage staff | `app/api/admin/stages/**`, `app/api/assistante/stages/route.ts` | P2 avec guards |
| Stage coach/parent/élève | `app/api/coach/stages/route.ts`, etc. | P2 avec guards |
| Factures | `app/api/admin/invoices/**`, `app/api/invoices/**` | P2, scope ADMIN/ASSISTANTE/PARENT |
| Documents | routes admin/student/coach/NPC | P2, download RBAC complet |
| Paiements | `app/api/payments/clictopay/**` | P1 (webhook stub), init P2 |
| Identité | `app/api/parent/children/route.ts`, `app/api/coach/students/**` | P2, V1 scope |

La revue M0A-R validera cet inventaire pour les exigences spécifiques Pré-rentrée V2 sans recréer l'inventaire from scratch.

## Fonctions et signatures futures

```ts
// lib/stages/v2/authorization/types.ts
export type PreRentreeAction =
  | 'READ' | 'CREATE' | 'UPDATE' | 'SUBMIT' | 'CONFIRM' | 'CANCEL'
  | 'ASSIGN' | 'PUBLISH' | 'RECORD_ATTENDANCE' | 'READ_PAYMENT'
  | 'REFUND' | 'READ_DOCUMENT' | 'ARCHIVE' | 'EXPORT';

export type PreRentreeResource =
  | 'EDITION' | 'MODULE' | 'COHORT' | 'SESSION' | 'APPLICATION'
  | 'PROPOSAL' | 'ENROLLMENT' | 'ASSIGNMENT' | 'GUARDIAN_RELATIONSHIP'
  | 'PAYMENT' | 'REFUND' | 'DOCUMENT' | 'AUDIT';

export type PreRentreeSubject = {
  userId: string | null;
  role: UserRole | 'VISITOR';
  studentId?: string;
  parentProfileId?: string;
  grants: readonly PreRentreeGrantView[];
};

export type PreRentreeAuthorizationInput = {
  action: PreRentreeAction;
  resource: PreRentreeResource;
  resourceId?: string;
  editionId?: string;
  studentId?: string;
  cohortId?: string;
  state?: string;
  now: Date;
};

export type AuthorizationDecision =
  | { allowed: true; scope: 'PUBLIC' | 'OWN' | 'ASSIGNED' | 'EDITION' | 'FINANCIAL' }
  | { allowed: false; reasonCode: string; audit: boolean };

export function authorizePreRentree(
  subject: PreRentreeSubject,
  input: PreRentreeAuthorizationInput,
): AuthorizationDecision;

// lib/stages/v2/authorization/guard.ts
export async function requirePreRentreeAccess(
  request: NextRequest,
  input: Omit<PreRentreeAuthorizationInput, 'now'>,
): Promise<PreRentreeAuthorizedContext | NextResponse>;

// lib/stages/v2/authorization/scope.ts
export async function loadPreRentreeAuthorizationContext(
  tx: Prisma.TransactionClient,
  subject: AuthSession,
  resource: PreRentreeResourceRef,
  now: Date,
): Promise<PreRentreeAuthorizationContext | null>;

export function redactSecurityMetadata(
  metadata: Record<string, unknown>,
): RedactedSecurityMetadata;
```

Le loader DB n'est activé qu'après M1/M3. Avant, les tests du moteur pur utilisent des fixtures typées ; aucune route V2 n'est créée.

## Séquence M0A-R — Revue et fermeture des écarts

> Les tâches originales (Task 1–8) sont reclassées ci-dessous. Les éléments déjà
> implémentés sur main ne sont pas recréés ; seule la revue et les écarts sont traités.

### R-01: Vérifier l'inventaire des guards existant (ex SEC-01)

**Statut :** `ALREADY_IMPLEMENTED_REVIEW_ONLY`

L'inventaire existe (`API_GUARD_INVENTORY.md`, 176 routes, P0=0, P1=2). Le script
`audit-api-guards.mjs` détecte les routes non classées. Le test
`audit-api-guards.classification.test.ts` couvre la classification.

- [ ] Exécuter le script d'audit et vérifier P0=0.
- [ ] Vérifier que les routes Pré-rentrée futures ne sont pas pré-ouvertes.
- [ ] Documenter les résultats dans la preuve M0A-R.

### R-02: Vérifier l'authentification fail-closed (ex SEC-02)

**Statut :** `ALREADY_IMPLEMENTED_REVIEW_ONLY`

`requireAuth`, `requireAnyRole` retournent 401/403 NextResponse. Session vérifie
id, role, email. Les tests existants couvrent les cas d'erreur.

- [ ] Relire `lib/guards.ts` et confirmer la couverture fail-closed.
- [ ] Exécuter les tests guards existants.
- [ ] Vérifier l'absence de chemin d'exception non converti en 401.
- [ ] Documenter les résultats.

### R-03: Déclarer les types V2 authorization en DENY par défaut (ex SEC-03)

**Statut :** `PRE_RENTREE_SPECIFIC` — à implémenter uniquement quand les routes V2 existent

Les types (`PreRentreeAction`, `PreRentreeResource`, `PreRentreeSubject`,
`AuthorizationDecision`) restent documentés dans les fonctions et signatures futures
ci-dessus. Ils seront implémentés dans le cadre de M1+ quand les routes V2 seront créées.

- [ ] Confirmer qu'aucune route V2 n'existe sur la branche.
- [ ] Confirmer qu'aucun type V2 ne doit être implémenté sans consommateur.
- [ ] Reclasser en `DEFERRED_TO_M1`.

### R-04: Scope loaders ABAC DB (ex SEC-04)

**Statut :** `DEFERRED_TO_M3`

Dépend du modèle `PreRentreeGuardianRelationship` (M3) et `PreRentreeTeacherAssignment` (M1).
Les guards V1 (`requireParentOwnsStudent`, `requireCoachAssignedToStudent`) restent actifs.

### R-05: Redaction PII (ex SEC-05)

**Statut :** `GAP_CLOSURE_REQUIRED`

Aucun helper `lib/security/redaction.ts` n'existe. Les logs webhook sont minimaux
mais aucun audit exhaustif n'a vérifié l'absence de PII dans tous les logs.

- [ ] Évaluer le risque réel : les routes hardened loggent-elles des PII ?
- [ ] Si écart démontré, créer le helper et les tests.
- [ ] Si non démontré, documenter comme risque P2 à traiter dans un lot dédié.

### R-06: Vérifier factures et documents (ex SEC-06)

**Statut :** `ALREADY_IMPLEMENTED_REVIEW_ONLY`

`buildInvoiceAccessWhere`, `notFoundResponse`, download RBAC, realpath, storage-root
sont tous sur main avec tests (286 lignes download, 134 lignes date, access-scope).

- [ ] Exécuter les tests documents et factures existants.
- [ ] Vérifier `Cache-Control: private, no-store` et absence de `localPath` dans les DTO.
- [ ] Documenter les résultats.

### R-07: Vérifier webhook ClicToPay (ex SEC-07)

**Statut :** `ALREADY_IMPLEMENTED_REVIEW_ONLY` + `GAP_CLOSURE_REQUIRED` (hex validation)

Signature HMAC-SHA256 + timingSafeEqual + secret-first + fail-closed 501 sont sur main.
Écart identifié : validation format hex du header signature (POST-MERGE-CHORES).

- [ ] Exécuter les tests webhook existants.
- [ ] Évaluer si la validation hex est un risque P0/P1 justifiant une correction M0A-R.
- [ ] Documenter les limites (payload parsing, idempotence, state machine) comme `DEFERRED_TO_PAYMENT_EVIDENCE`.

### R-08: Gate de sécurité et preuve (ex SEC-08)

**Statut :** `STILL_REQUIRED`

- [ ] Exécuter toutes les suites de tests sécurité (guards, IDOR, documents, factures, webhook).
- [ ] Exécuter typecheck et script d'audit.
- [ ] Enregistrer SHA, commandes, nombres de tests, écarts connus.
- [ ] Marquer `VERIFIED_IN_TEST` uniquement si tous les P0 sont verts.
- [ ] Les scopes parent V2 restent bloqués jusqu'à M3.

## Responsabilités et compatibilité

| Rôle | Droit M0A |
|---|---|
| visiteur | routes allowlistées et rate-limitées uniquement |
| parent/élève/coach | aucune portée V2 sans preuve relationnelle/affectation |
| assistante | opérations administratives explicitement permises, jamais finance write |
| pédagogie | règles/cohortes, jamais paiement |
| finance | argent, jamais arbitrage pédagogique |
| admin | opérations sensibles confirmées/auditées, pas de bypass de scope implicite |

V1 conserve `Student.parentId`, `CoachStudentAssignment` et ses policies existantes. Les nouvelles fonctions sont additives ; une route V1 n'est migrée vers elles que par ticket séparé avec tests avant/après.

## Critères GO/NO-GO

GO M0A-R : inventaire vérifié P0=0, auth fail-closed confirmé, factures/documents/webhook sans P0, tests IDOR verts, revue Sol xhigh, preuve datée, écarts fermés ou documentés. NO-GO : route mutante non classée, scope par email, coach global, finance exposée, test P0 skippé, écart P0 non documenté.

Une route V2 reste interdite tant que M0A-R n'est pas vérifié et `VERIFIED_IN_TEST` ; la validation production est une gate ultérieure distincte. Les politiques parent M:N restent bloquées jusqu'à M3.
