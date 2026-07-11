# Pré-rentrée 2026 M0A Security Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are explicitly authorized) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer `GATE-SEC-BASE-001` de `DESIGN_BASELINE_DEFINED` à `VERIFIED_IN_TEST` sans exposer de route V2 et sans régresser V1.

**Architecture:** Les guards globaux restent compatibles V1 ; une couche V2 additive combine authentification fail-closed, RBAC, ABAC et portée de requête. Les ressources sont filtrées avant lecture, les refus sont minimisés et auditables, et les invariants de la branche locale de sécurité sont réévalués plutôt que cherry-pickés.

**Tech Stack:** NextAuth 5 beta, Next.js Route Handlers, TypeScript, Zod, Prisma 6.19.2, Jest, PostgreSQL 15.

---

## État observé

- `origin/main` contient `lib/guards.ts`, `lib/api-guard.ts`, `lib/rbac.ts` et des tests RBAC/IDOR étendus.
- `requireAuth()` appelle actuellement `auth()` sans convertir toute exception en refus uniforme.
- Les helpers parent V1 utilisent `Student.parentId`; la V2 devra utiliser exclusivement `PreRentreeGuardianRelationship` après M3.
- Le coach V1 est porté par `CoachStudentAssignment`; la V2 devra vérifier `PreRentreeTeacherAssignment` et la cohorte.
- Le webhook ClicToPay vérifie la signature seulement si le secret existe : l'absence de secret doit devenir fail-closed avant toute activation.
- `origin/main` vaut `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`. La branche locale `g-sec/api-guards` inspectée à `8f3356f1f45eed4c45327d852a9a3b516e3eff2f` contient de nombreux commits supplémentaires : download realpath/storage root, instrumentation/guards, validation date, seed/test DB guards, webhook et gates. Elle est une source de cas de test, jamais une dépendance ou un lot à cherry-picker.

## Inventaire de routes à figer

| Famille | Chemins actuels à inventorier | Invariant |
|---|---|---|
| Stage public | `app/api/stages/**` | public explicite, validation/rate limit, aucune confiance prix/capacité client |
| Stage staff | `app/api/admin/stages/**`, `app/api/assistante/stages/route.ts` | rôle + portée + mutation auditée |
| Stage coach/parent/élève | `app/api/coach/stages/route.ts`, `app/api/parent/stages/route.ts`, `app/api/student/stages/route.ts`, `app/api/eleve/stages/route.ts` | aucune lecture globale, propriété avant lecture |
| Factures | `app/api/admin/invoices/**`, `app/api/invoices/**` | admin/finance ou responsable autorisé, 404 sans oracle |
| Documents | `app/api/admin/documents/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/student/documents/**`, routes coach/NPC | scope DB, chemin canonique, aucune fuite PII/path |
| Paiements | `app/api/payments/clictopay/**`, `app/api/payments/validate/route.ts` | preuve serveur, signature obligatoire, idempotence |
| Identité | `app/api/parent/children/route.ts`, `app/api/coach/students/**` | V1 inchangé ; futur V2 relation/affectation vérifiée |

La preuve future sera `docs/evidence/pre-rentree-2026/m0a-route-guard-inventory.md`, générée/revue à partir de `rg --files app/api` et du script existant d'audit des guards s'il est présent sur la baseline d'implémentation.

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

## Séquence TDD atomique

### Task 1: Figer l'inventaire et les tests de non-régression V1

**Files:**
- Create: `docs/evidence/pre-rentree-2026/m0a-route-guard-inventory.md`
- Modify: `__tests__/architecture/site-architecture-guards.test.ts`
- Test: `__tests__/lib/guards.complete.test.ts`, `__tests__/lib/rbac.coverage.test.ts`

- [ ] Énumérer toutes les routes et classer `PUBLIC`, `AUTH_ONLY`, `RBAC`, `RBAC_ABAC`, `WEBHOOK`.
- [ ] Ajouter un test échouant si une nouvelle route mutante n'a ni guard ni allowlist publique justifiée.
- [ ] Exécuter `npm test -- --runInBand __tests__/architecture/site-architecture-guards.test.ts` ; attendu avant correction : échec sur toute route non classée.
- [ ] Compléter uniquement l'instrumentation/allowlist avec justification ; ne pas assouplir un guard.
- [ ] Exécuter les trois suites ; attendu : PASS.
- [ ] Commit recommandé : `test(security): freeze API guard inventory`.

### Task 2: Rendre l'authentification centrale fail-closed

**Files:**
- Modify: `lib/guards.ts`
- Modify: `lib/api-guard.ts`
- Test: `__tests__/lib/guards.complete.test.ts`, `__tests__/lib/guards.test.ts`

- [ ] Écrire les tests : `auth()` lève, session sans id/rôle/email, rôle inconnu, réponse sans détail interne.
- [ ] Vérifier l'échec des nouveaux tests.
- [ ] Encapsuler l'appel auth, retourner 401 uniforme et logger seulement `requestId/reasonCode` redacted.
- [ ] Conserver les signatures V1 publiques ou fournir un adaptateur compatible.
- [ ] Rejouer toutes les suites guards/RBAC ; attendu : aucune régression.
- [ ] Commit : `fix(security): make API authentication fail closed`.

### Task 3: Créer le moteur RBAC/ABAC V2 pur

**Files:**
- Create: `lib/stages/v2/authorization/types.ts`
- Create: `lib/stages/v2/authorization/policies.ts`
- Create: `lib/stages/v2/authorization/errors.ts`
- Test: `__tests__/lib/stages/v2/authorization/policies.test.ts`

- [ ] Écrire une table de tests pour visiteur, élève, parent, coach, pédagogie, assistante, finance, admin.
- [ ] Tester finance absente coach/élève et séparation pédagogie/finance.
- [ ] Implémenter `authorizePreRentree` en données déclaratives, défaut deny.
- [ ] Refuser action, ressource, état ou grant inconnus.
- [ ] Exécuter la suite unitaire ; attendu : PASS et couverture de chaque cellule de la matrice.
- [ ] Commit : `feat(security): add pre-rentree V2 policy engine`.

### Task 4: Ajouter les loaders de portée sans accès par email

**Files:**
- Create: `lib/stages/v2/authorization/context.ts`
- Create: `lib/stages/v2/authorization/scope.ts`
- Test: `__tests__/integration/pre-rentree-v2-authorization-scope.db.test.ts`

- [ ] Après M1/M3 seulement, écrire les tests DB parent VERIFIED/expiré/révoqué et coach affecté/non affecté.
- [ ] Implémenter des `findFirst({ where: { id, ...scope } })`, jamais `findUnique` suivi d'un contrôle tardif.
- [ ] Vérifier que l'email/téléphone n'apparaît dans aucune condition d'autorité.
- [ ] Retourner `null` hors portée pour produire un 404 sans oracle.
- [ ] Commit : `feat(security): scope pre-rentree resources by verified relations`.

### Task 5: Journaliser les refus sans PII

**Files:**
- Create: `lib/security/redaction.ts`
- Create: `lib/stages/v2/authorization/security-audit.ts`
- Test: `__tests__/lib/security/redaction.test.ts`

- [ ] Tester email, téléphone, token, signature, localPath et payload fournisseur.
- [ ] Implémenter une allowlist de métadonnées (`requestId`, action, resourceType, reasonCode, actorId hashé si nécessaire).
- [ ] Interdire le spread d'un body/request/error brut dans le logger.
- [ ] Vérifier snapshots de logs.
- [ ] Commit : `feat(security): redact authorization audit metadata`.

### Task 6: Fermer les écarts factures et documents de la baseline

**Files:**
- Review/Modify only if failing: `app/api/admin/invoices/**`, `app/api/invoices/**`, `lib/invoice/**`
- Review/Modify only if failing: `app/api/documents/[id]/route.ts`, `app/api/student/documents/[id]/download/route.ts`, `app/api/admin/documents/route.ts`
- Possible Create: `lib/documents/storage-root.ts`
- Tests: `__tests__/api/admin.invoices*.test.ts`, `__tests__/lib/invoice/*.test.ts`, `__tests__/api/documents*.test.ts`, `__tests__/security/path-traversal.test.ts`

- [ ] Rejouer d'abord les tests existants et comparer les invariants avec `g-sec/api-guards` en lecture seule.
- [ ] Ajouter des tests 404 oracle, parent direct propriétaire, coach hors scope, realpath racine/candidat, symlink et fichier absent.
- [ ] Implémenter uniquement les invariants manquants sur la baseline courante ; aucun cherry-pick massif.
- [ ] Vérifier `Cache-Control: private, no-store` et absence de `localPath` dans les DTO/logs.
- [ ] Commit : `fix(security): close invoice and document ownership gaps`.

### Task 7: Rendre ClicToPay strictement fail-closed

**Files:**
- Modify: `app/api/payments/clictopay/webhook/route.ts`
- Possible Create: `lib/payments/clictopay/verify-webhook.ts`
- Test: `__tests__/api/payments.clictopay.webhook.route.test.ts`

- [ ] Tester secret absent, signature absente/invalide, corps modifié, replay, doublon exact et erreur de parse.
- [ ] Exiger le secret avant toute mutation et lire le corps brut une seule fois.
- [ ] Ne pas implémenter la mutation paiement V2 dans M0A ; conserver 501 après authentification si le fournisseur reste non configuré.
- [ ] Logger event id/hash et code, jamais secret/body complet.
- [ ] Commit : `fix(payments): fail closed when ClicToPay webhook is unconfigured`.

### Task 8: Gate de sécurité et non-régression

**Files:**
- Create: `docs/evidence/pre-rentree-2026/m0a-security-verification.md`
- Modify after evidence: `docs/specs/pre-rentree-2026-activation-gates.md`

- [ ] Exécuter `npm test -- --runInBand __tests__/lib/guards.complete.test.ts __tests__/lib/rbac.coverage.test.ts`.
- [ ] Exécuter les suites IDOR, documents, factures et webhook ciblées.
- [ ] Exécuter `npm run typecheck` et le test d'architecture des guards.
- [ ] Enregistrer SHA, commandes, nombres de tests, écarts connus et reviewer.
- [ ] Marquer `VERIFIED_IN_TEST` uniquement si tous les P0/P1 sont verts et M3 confirme les scopes parent.
- [ ] Commit : `docs(security): record M0A verification evidence`.

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

GO M0A : inventaire complet, auth fail-closed, moteur deny-by-default, redaction, factures/documents/webhook sans P0, tests IDOR verts, revue Sol xhigh, preuve datée. NO-GO : route mutante non classée, scope par email, coach global, secret webhook optionnel, finance exposée, test P0 skippé ou dépendance à une branche non fusionnée.

Une route V2 reste interdite tant que M0A n'est pas implémenté, testé, revu et `VERIFIED_IN_TEST`; la validation production est une gate ultérieure distincte.
