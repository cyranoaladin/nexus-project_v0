# Réconciliation sécurité — main actuel vs exigences Pré-rentrée M0A

> Date : 2026-07-11
> Branche : `integration/pre-rentree-2026-current`
> Base : `origin/main` @ `c90b142c88d69bdc600f3f848b44ca0317c00242`
> Commits de hardening analysés :
> - `b2ea32f0b` — G-SEC hardening (13 review rounds)
> - `ac02f548b` — G-PAY fail-closed hardening
> - `c90b142c8` — post-merge matrix + chores tracker

---

## Contexte

Les documents Pré-rentrée (commits documentaires `71b234e27`..`0409a5b5e`) ont été
rédigés avec `origin/main` à `db04d23f3`. Depuis, trois commits de hardening sécurité
ont été fusionnés sur main. Ce document évalue chaque exigence M0A à la lumière du code
réellement présent sur main.

---

## Classification par exigence M0A

### 1. Authentification centralisée

| Exigence | Statut | Preuve |
|----------|--------|--------|
| `requireAuth()` centralisé | IMPLEMENTED_ON_MAIN | `lib/guards.ts:50-64` — vérifie session, id, role, email |
| `requireRole()` / `requireAnyRole()` | IMPLEMENTED_ON_MAIN | `lib/guards.ts:66-120` — retourne 401/403 NextResponse |
| `isErrorResponse()` type guard | IMPLEMENTED_ON_MAIN | `lib/guards.ts:122-130` |
| `isOwner()` / `isStaff()` helpers | IMPLEMENTED_ON_MAIN | `lib/guards.ts:132-145` |
| Auth fail-closed uniforme | IMPLEMENTED_BUT_NOT_VERIFIED_FOR_PRE_RENTREE | Guards retournent 401/403, mais uniformité sur les 176 routes non prouvée route par route pour V2 |
| Rôle client ignoré | IMPLEMENTED_ON_MAIN | Session côté serveur via NextAuth, aucun rôle client accepté |

### 2. Autorisation RBAC

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Guards centralisés par rôle | IMPLEMENTED_ON_MAIN | `requireAnyRole()` utilisé dans les routes hardened |
| Matrice de classification 176 routes | IMPLEMENTED_ON_MAIN | `docs/security/API_GUARD_INVENTORY.md` — P0=0, P1=2 |
| Script d'audit automatisé | IMPLEMENTED_ON_MAIN | `scripts/security/audit-api-guards.mjs` — 280 lignes |
| Routes publiques allowlistées | IMPLEMENTED_ON_MAIN | 3 routes PUBLIC_BY_DESIGN (inscrire, activate, bilan-gratuit) |
| Séparation finance/pédagogie | PARTIALLY_IMPLEMENTED | Invoice scope ADMIN/ASSISTANTE/PARENT, coach exclu ; mais pas encore formalisé comme politique déclarative |
| Politique RBAC/ABAC déclarative V2 | NOT_IMPLEMENTED | `lib/stages/v2/authorization/` n'existe pas — prévu par M0A plan |
| Types V2 (PreRentreeAction, PreRentreeResource) | NOT_IMPLEMENTED | Types futurs documentés dans le plan M0A mais pas implémentés |

### 3. Autorisation ABAC (scope ressource)

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Coach scopé par affectation | IMPLEMENTED_ON_MAIN | `requireCoachAssignedToStudent()` dans `lib/guards.ts` ; `assertCoachCanAccessStudent()` dans download |
| Parent scopé par propriété | IMPLEMENTED_ON_MAIN | `requireParentOwnsStudent()`, `requireParentOwnsInvoice()`, `buildInvoiceAccessWhere()` |
| Élève scopé à ses ressources | IMPLEMENTED_ON_MAIN | `requireStudentOwnsResource()` + download route ELEVE check |
| `enforceOwnership()` dispatcher | IMPLEMENTED_ON_MAIN | `lib/guards.ts` — dispatch par policyKey |
| IDOR bilans/generate corrigé | IMPLEMENTED_ON_MAIN | `buildBilanWriteWhere()` / `buildBilanReadWhere()` — coach A ≠ coach B |
| Relation parent V2 M:N vérifiée | REQUIRES_M3 | Dépend de `PreRentreeGuardianRelationship` — M3 |
| Affectation coach V2 | REQUIRES_M3 | Dépend de `PreRentreeTeacherAssignment` — M3 |
| Scope loaders V2 (context/scope) | NOT_IMPLEMENTED | Prévu après M1/M3 |

### 4. Documents et fichiers

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Route download avec RBAC complet | IMPLEMENTED_ON_MAIN | `app/api/documents/[id]/download/route.ts` — 221 lignes, staff/coach/parent/élève |
| Protection traversée de chemin | IMPLEMENTED_ON_MAIN | `realpath()` sur root ET candidat, rejet URL http/https |
| Storage root centralisé | IMPLEMENTED_ON_MAIN | `lib/documents/storage-root.ts` — env ou cwd/storage/documents |
| Préfixe legacy géré | IMPLEMENTED_ON_MAIN | `LEGACY_STORAGE_PREFIX` — `/app/storage/documents/` |
| Limite taille fichier | IMPLEMENTED_ON_MAIN | 25 MB MAX_DOWNLOAD_BYTES |
| Content-Type allowlist | IMPLEMENTED_ON_MAIN | PDF, JPEG, PNG, WebP, text uniquement |
| Headers sécurisés | IMPLEMENTED_ON_MAIN | `nosniff`, `private, no-store` |
| `localPath` absent des DTO | IMPLEMENTED_BUT_NOT_VERIFIED_FOR_PRE_RENTREE | Vérifié dans download route, pas audité exhaustivement sur toutes les routes |

### 5. Factures

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Invoice scope par rôle | IMPLEMENTED_ON_MAIN | `buildInvoiceAccessWhere()` — ADMIN/ASSISTANTE full, PARENT scoped, autres deny |
| Réponse 404 sans fuite | IMPLEMENTED_ON_MAIN | `notFoundResponse()` dans `lib/invoice/not-found.ts` — 404 identique pour deny et absent |
| `Cache-Control: no-store` | IMPLEMENTED_ON_MAIN | Dans notFoundResponse headers |
| Validation date stricte | IMPLEMENTED_ON_MAIN | `civilDateSchema` — round-trip, rejette 2024-02-31 |
| Coach/élève exclus finance | IMPLEMENTED_ON_MAIN | `buildInvoiceAccessWhere` retourne null pour coach/élève |

### 6. ClicToPay webhook

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Vérification signature HMAC-SHA256 | IMPLEMENTED_ON_MAIN | `webhook/route.ts:27-45` — `createHmac` + `timingSafeEqual` |
| Secret-first (header avant body) | IMPLEMENTED_ON_MAIN | Secret vérifié ligne 17, header ligne 22, body ligne 30 |
| Fail-closed sans secret | IMPLEMENTED_ON_MAIN | 501 CLICTOPAY_NOT_CONFIGURED sans consommer le body |
| Signature manquante → 401 | IMPLEMENTED_ON_MAIN | Ligne 24 |
| Timing-safe comparison | IMPLEMENTED_ON_MAIN | `timingSafeEqual` avec try-catch pour length mismatch |
| Validation format hex signature | NOT_IMPLEMENTED | Mentionné dans POST-MERGE-CHORES mais pas encore codé |
| Parsing payload (orderId, status) | NOT_IMPLEMENTED | TODO dans le code — logique métier absente |
| Idempotence (doublon webhook) | NOT_IMPLEMENTED | Pas de contrainte DB ni vérification doublon |
| Validation montant/devise | NOT_IMPLEMENTED | Pas de comparaison serveur |
| Transition d'état interdite | NOT_IMPLEMENTED | Pas de state machine |
| Mutation Payment/ClicToPayTransaction | NOT_IMPLEMENTED | Retourne 501 après vérification signature |
| Rotation de secret | NOT_IMPLEMENTED | Chore planifiée dans POST-MERGE-CHORES |

### 7. ClicToPay init

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Guard `requireAnyRole` | IMPLEMENTED_ON_MAIN | PARENT, ADMIN, ASSISTANTE |
| Validation Zod stricte | IMPLEMENTED_ON_MAIN | amount, invoiceId, description + `.strict()` |
| Fail-closed sans configuration | IMPLEMENTED_ON_MAIN | 501 quand pas configuré |
| Logique d'initiation réelle | NOT_IMPLEMENTED | Retourne 501 — stub |

### 8. Parsing et validation

| Exigence | Statut | Preuve |
|----------|--------|--------|
| `parseJsonBody()` helper | IMPLEMENTED_ON_MAIN | `lib/api/helpers.ts` — sentinel empty, throw malformed |
| Validation Zod sur mutations | PARTIALLY_IMPLEMENTED | 7 routes migrées vers parseJsonBody, ~13 restantes (POST-MERGE-CHORES) |
| Schémas date stricts | IMPLEMENTED_ON_MAIN | `civilDateSchema`, `strictDateSchema` dans `lib/validation/common.ts` |

### 9. Logs et redaction

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Redaction PII dans les logs | IMPLEMENTED_M0A_R | `lib/security/redact-for-logging.ts` créé, 25 tests, appliqué au webhook |
| Pas d'email/phone/token dans les logs | IMPLEMENTED_BUT_NOT_VERIFIED_FOR_PRE_RENTREE | Webhook logs uniquement code/error, pas d'audit exhaustif |
| Correlation ID | PARTIALLY_IMPLEMENTED | `generateRequestId()` existe, pas systématiquement utilisé |

### 10. Tests de sécurité

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Tests IDOR bilans | IMPLEMENTED_ON_MAIN | `bilans.generate.idor.test.ts` — 161 lignes |
| Tests document download | IMPLEMENTED_ON_MAIN | `documents-download.test.ts` — 286 lignes |
| Tests document access | IMPLEMENTED_ON_MAIN | `documents-access.test.ts` — shape-lock, URL vs storage |
| Tests invoice date | IMPLEMENTED_ON_MAIN | `invoices.issuedAt.test.ts` — 134 tests |
| Tests webhook signature | IMPLEMENTED_ON_MAIN | `payments.clictopay.webhook.test.ts` — 47 tests |
| Tests webhook route | IMPLEMENTED_ON_MAIN | `payments.clictopay.webhook.route.test.ts` |
| Tests init route | IMPLEMENTED_ON_MAIN | `payments.clictopay.init.route.test.ts` |
| Tests parent activation | IMPLEMENTED_ON_MAIN | `parent.children.activation.route.test.ts` — SHA-256 |
| Tests invoice access scope | IMPLEMENTED_ON_MAIN | `invoice/access-scope.test.ts` — ASSISTANTE scope |
| Tests pre-commit hook | IMPLEMENTED_ON_MAIN | `pre-commit-hook.test.ts` — 148 lignes |
| Tests seed guard | IMPLEMENTED_ON_MAIN | `seed-e2e-guard.test.ts` — 79 lignes |
| Tests audit classification | IMPLEMENTED_ON_MAIN | `audit-api-guards.classification.test.ts` |
| Tests RBAC/ABAC V2 policy | NOT_IMPLEMENTED | Engine V2 n'existe pas encore |
| Tests redaction PII | NOT_IMPLEMENTED | Helper redaction n'existe pas |
| Tests non-régression V1 complète | IMPLEMENTED_BUT_NOT_VERIFIED_FOR_PRE_RENTREE | Tests existants couvrent V1, pas vérifiés spécifiquement pour Pré-rentrée |

### 11. Infrastructure et scripts

| Exigence | Statut | Preuve |
|----------|--------|--------|
| Audit automatisé des guards | IMPLEMENTED_ON_MAIN | `audit-api-guards.mjs` — détecte P0/P1/PUBLIC/P2/OK |
| Pre-commit secret scanning | IMPLEMENTED_ON_MAIN | `pre-commit-hook.sh` — 3 couches (nom, pattern, valeur) |
| Gate-all.sh preflight | IMPLEMENTED_ON_MAIN | Validation env, DB safety, healthcheck |
| Seed guard DB | IMPLEMENTED_ON_MAIN | `lib/e2e/seed-guard.ts` + `seed-e2e-db.ts` |

---

## Synthèse quantitative

| Statut | Nombre |
|--------|--------|
| IMPLEMENTED_ON_MAIN | 38 |
| IMPLEMENTED_BUT_NOT_VERIFIED_FOR_PRE_RENTREE | 4 |
| PARTIALLY_IMPLEMENTED | 3 |
| NOT_IMPLEMENTED | 10 |
| REQUIRES_M3 | 3 |
| REQUIRES_PAYMENT_PROVIDER_EVIDENCE | 0 (classé NOT_IMPLEMENTED + chores) |
| NOT_APPLICABLE | 0 |

---

## Éléments NOT_IMPLEMENTED — analyse de pertinence M0A-R

| Élément | Pertinence M0A-R | Recommandation |
|---------|-------------------|----------------|
| Politique RBAC/ABAC déclarative V2 | PRE_RENTREE_SPECIFIC | Créer uniquement quand les routes V2 existent (M1+) — DENY par défaut suffit |
| Types V2 authorization | PRE_RENTREE_SPECIFIC | Déclarer les types sans ouvrir de route — DEFERRED_TO_M1 |
| Scope loaders V2 | DEFERRED_TO_M3 | Dépend du modèle M:N |
| Redaction PII helper | IMPLEMENTED_M0A_R | `lib/security/redact-for-logging.ts` créé |
| Validation hex signature webhook | IMPLEMENTED_M0A_R | Regex `/^[0-9a-f]{64}$/i` + normalisation lowercase, 7 tests |
| Parsing payload webhook | DEFERRED_TO_PAYMENT_EVIDENCE | Dépend de la documentation fournisseur |
| Idempotence webhook | DEFERRED_TO_PAYMENT_EVIDENCE | Dépend du modèle ClicToPayTransaction V2 |
| Validation montant/devise | DEFERRED_TO_PAYMENT_EVIDENCE | Requiert payload documenté |
| State machine paiement | DEFERRED_TO_PAYMENT_EVIDENCE | Requiert modèle V2 |
| Mutation Payment webhook | DEFERRED_TO_PAYMENT_EVIDENCE | Retourne 501, gate fermé |

---

## P1 résiduels sur main (API_GUARD_INVENTORY)

| Route | Priorité | Raison | Action M0A-R |
|-------|----------|--------|--------------|
| `api/assessments/submit` | P1 | Token HMAC absent — soumissions fantômes possibles | REVIEW_ONLY — hors périmètre Pré-rentrée |
| `api/payments/clictopay/webhook` | P1 | Business logic stubbed (501) | DEFERRED_TO_PAYMENT_EVIDENCE — gate fermé |

---

## Chores POST-MERGE planifiées (c90b142c8)

| Chore | Impact M0A-R | Statut |
|-------|-------------|--------|
| `download-streaming` | Amélioration, non bloquant | DEFERRED |
| `audit-per-method-guards` | Utile mais non bloquant pour V2 | DEFERRED |
| `instrument-precision-2` | Réduction P2→OK, cosmétique | DEFERRED |
| `clictopay-signature-format` | GAP_CLOSURE si hex validation ajoutée | REVIEW_REQUIRED |
| `stabilize-flaky-tests` | Non bloquant si flaky identifiés | DEFERRED |

---

## Conclusion

Le hardening G-SEC/G-PAY a implémenté la majorité du socle de sécurité que M0A devait
construire from scratch. Le périmètre M0A doit être recadré en M0A-R (Review and Gap
Closure) pour :

1. **Vérifier** les implémentations existantes contre les exigences Pré-rentrée
2. **Fermer les écarts** démontrés (redaction PII, hex validation webhook)
3. **Déclarer** les types V2 en DENY par défaut sans ouvrir de route
4. **Reporter** les éléments dépendant de M3 ou d'une preuve fournisseur paiement

Le statut de GATE-SEC-BASE-001 est désormais :
**VERIFIED_IN_TEST** (M0A-R complété 2026-07-11)
