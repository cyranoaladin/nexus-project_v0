# Pré-rentrée 2026 M3 Guardian Relation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une relation M:N responsable–élève vérifiée sans supprimer, réécrire ou doubler durablement `Student.parentId`.

**Architecture:** `ParentProfile` reste l'identité responsable existante ; une table temporelle porte type, vérification et droits V2. Le backfill transforme le FK V1 en candidats `PENDING_VERIFICATION`, jamais en autorité automatique, puis une revue humaine produit les relations vérifiées.

**Tech Stack:** Prisma 6.19.2, PostgreSQL 15, transactions par lots, CLI TypeScript, policies M0A.

---

## Préconditions

- M1/M2 appliqués et vérifiés.
- M0A implémenté/revu ; aucune route parent V2 active.
- Tables `pre_rentree_enrollments` et applications contractuelles sans écritures réelles. Si une inscription M1 existe, M3 s'arrête avant ajout du FK requis.
- Sauvegarde/restauration M0B et harness M0D disponibles.

## Enums M3 exacts

```prisma
enum PreRentreeGuardianRelationType {
  MOTHER
  FATHER
  LEGAL_GUARDIAN
  OTHER
}

enum PreRentreeGuardianVerificationStatus {
  PROPOSED
  PENDING_VERIFICATION
  VERIFIED
  REJECTED
  REVOKED
  EXPIRED
}
```

## Modèle exact

```prisma
model PreRentreeGuardianRelationship {
  id                  String @id @default(cuid())
  studentId           String
  student             Student @relation(fields: [studentId], references: [id], onDelete: Restrict)
  parentProfileId     String
  parentProfile       ParentProfile @relation(fields: [parentProfileId], references: [id], onDelete: Restrict)
  relationType        PreRentreeGuardianRelationType
  verificationStatus  PreRentreeGuardianVerificationStatus @default(PROPOSED)
  rights              String[] @default([])
  isPrimary           Boolean @default(false)
  validFrom           DateTime @db.Date
  validUntil          DateTime? @db.Date
  source              String @db.VarChar(64)
  verifiedById        String?
  verifiedBy          User? @relation("PreRentreeGuardianVerifiedBy", fields: [verifiedById], references: [id], onDelete: SetNull)
  verifiedAt          DateTime? @db.Timestamptz(3)
  revokedById         String?
  revokedBy           User? @relation("PreRentreeGuardianRevokedBy", fields: [revokedById], references: [id], onDelete: SetNull)
  revokedAt           DateTime? @db.Timestamptz(3)
  revocationReason    String? @db.Text
  version             Int @default(1)
  createdAt           DateTime @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime @updatedAt @db.Timestamptz(3)

  applications        PreRentreeApplication[]
  enrollments         PreRentreeEnrollment[]

  @@unique([studentId, parentProfileId, validFrom])
  @@index([parentProfileId, verificationStatus, validUntil])
  @@index([studentId, verificationStatus, validUntil])
  @@map("pre_rentree_guardian_relationships")
}
```

Back-relations à ajouter : `ParentProfile.preRentreeGuardianRelationships`, `Student.preRentreeGuardianRelationships`, et les deux relations nommées dans `User`.

## Colonnes ajoutées aux agrégats M1

```prisma
// PreRentreeApplication
guardianRelationshipId String?
guardianRelationship PreRentreeGuardianRelationship? @relation(
  fields: [guardianRelationshipId], references: [id], onDelete: Restrict
)

// PreRentreeEnrollment
guardianRelationshipId String
guardianRelationship PreRentreeGuardianRelationship @relation(
  fields: [guardianRelationshipId], references: [id], onDelete: Restrict
)
```

L'ajout requis sur enrollment n'est autorisé que si `SELECT COUNT(*) FROM pre_rentree_enrollments` vaut zéro. Sinon NO-GO et plan en deux temps nullable→backfill vérifié→NOT NULL à approuver séparément.

## Droits et source

- `rights` contient uniquement des codes du registre futur `GuardianRightCode`: `READ_PEDAGOGICAL`, `READ_SCHEDULE`, `READ_DOCUMENTS`, `READ_FINANCIAL`, `MANAGE_ENROLLMENT`, `RECEIVE_COMMUNICATIONS`.
- Le registre TypeScript/Zod est source des codes ; une valeur inconnue est refusée.
- Une relation issue de `Student.parentId` utilise `source='LEGACY_STUDENT_PARENT_ID'`.
- `validFrom` candidat est la date civile `Student.createdAt` dans `Africa/Tunis`, valeur déterministe et traçable ; une revue peut la rectifier avant vérification.
- Aucun droit n'est accordé à `PROPOSED/PENDING_VERIFICATION`; `rights=[]` lors de la génération.
- Archivage logique : `REVOKED` ou `EXPIRED`, dates/motif et audit ; aucun hard delete.

## SQL M3 complémentaire

```sql
ALTER TABLE pre_rentree_guardian_relationships
  ADD CONSTRAINT pre_rentree_guardian_date_order
    CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom"),
  ADD CONSTRAINT pre_rentree_guardian_verified_consistency
    CHECK (
      "verificationStatus" <> 'VERIFIED'
      OR ("verifiedAt" IS NOT NULL AND "verifiedById" IS NOT NULL)
    ),
  ADD CONSTRAINT pre_rentree_guardian_revoked_consistency
    CHECK (
      "verificationStatus" <> 'REVOKED'
      OR ("revokedAt" IS NOT NULL AND "revocationReason" IS NOT NULL)
    );

CREATE UNIQUE INDEX pre_rentree_one_verified_primary_guardian
  ON pre_rentree_guardian_relationships ("studentId")
  WHERE (
    "isPrimary" = true
    AND "verificationStatus" = 'VERIFIED'
    AND "revokedAt" IS NULL
  );
```

Le service expire explicitement une relation arrivée à `validUntil` avant de vérifier une nouvelle primaire. La policy vérifie toujours la date, même si le worker d'expiration n'a pas encore écrit `EXPIRED`.

## Coexistence V1/V2

| Domaine | Lecture | Écriture |
|---|---|---|
| V1 | `Student.parentId → ParentProfile` inchangé | workflows V1 existants uniquement |
| V2 | relation `VERIFIED`, active, droit requis | `guardianRelationshipService` uniquement |
| backfill | lit V1, écrit uniquement table M3/audit | aucune mutation User/ParentProfile/Student |

Il n'existe aucune synchronisation permanente. Une modification V1 ultérieure crée au mieux une alerte/candidate via une commande explicite, jamais une relation VERIFIED automatique.

## Catégories d'inventaire

| Code | Définition | Action automatique autorisée |
|---|---|---|
| `LEGACY_DIRECT_FK_CLEAN` | Student.parentId pointe un ParentProfile/User actifs, aucune relation candidate existante | créer candidat `PENDING_VERIFICATION`, droits vides |
| `LEGACY_RELATION_PROBABLE` | FK valide mais données de profil incomplètes/incohérentes | rapport seulement |
| `CONFLICT` | relation existante contradictoire ou primaire concurrente | revue obligatoire |
| `PARENT_MISSING` | FK/orphelin constaté malgré contraintes | rapport P0, aucune création |
| `DUPLICATE_CANDIDATE` | même student/parent/date déjà présent | no-op idempotent + rapport |
| `STUDENT_WITHOUT_GUARDIAN` | parentId absent/invalide sur donnée legacy | rapport P0 |
| `MULTIPLE_CANDIDATES` | plusieurs profils possibles via données secondaires | aucune association |
| `INVALID_DATA` | dates/IDs/types non conformes | quarantaine/report |

L'email/téléphone peut aider l'affichage de candidats masqués pour revue ; il ne détermine jamais l'association ou la fusion.

## Pipeline backfill

### 1. inventory

Lecture seule : comptes par catégorie, orphelins, doublons, relations existantes. Sortie JSON versionnée + Markdown, sans PII brute.

### 2. dry-run

Calcule les candidats/commandes avec hash stable `(studentId,parentProfileId,validFrom,source)` ; zéro écriture.

### 3. candidate generation

Produit un fichier chiffré hors Git ou une table de travail contrôlée, IDs opaques et raisons. Aucun compte/fusion.

### 4. manual review

Un admin autorisé choisit relationType, droits, primaire, période et décision. Reviewer distinct pour conflits.

### 5. apply

CLI exige `--plan-checksum`, `--batch-size` et `--review-batch-id`. Transaction par lot ; `upsert` sur clé déterministe ; audit dans la même transaction. Aucun défaut de batch-size codé.

### 6. verify

Relit source/candidats/relations, vérifie checksum, aucune relation VERIFIED sans actor/time/droits, aucune modification V1.

### 7. report

Comptes avant/après, no-op, erreurs, conflits restants, SHA Git, opérateur/reviewer. PII redacted.

## Fichiers futurs

| Fichier | Rôle |
|---|---|
| `lib/stages/v2/authorization/guardian-rights.ts` | union/Zod droits |
| `lib/stages/v2/services/guardian-relationship-service.ts` | transitions et policies |
| `scripts/pre-rentree/m3/guardian-inventory.ts` | lecture/catégorisation |
| `scripts/pre-rentree/m3/guardian-plan.ts` | dry-run/checksum |
| `scripts/pre-rentree/m3/guardian-apply.ts` | apply batch idempotent |
| `scripts/pre-rentree/m3/guardian-verify.ts` | invariants/report |
| `__tests__/integration/pre-rentree-v2/guardian-relationship.db.test.ts` | schéma/transitions |
| `__tests__/integration/pre-rentree-v2/guardian-backfill.db.test.ts` | pipeline |
| `__tests__/security/pre-rentree-v2-parent-idor.test.ts` | ABAC/IDOR |

## Tasks

1. Écrire tests enum/modèle/FK/checks, puis ajouter schema Prisma.
2. Générer migration `student_guardian_relationship` en create-only.
3. Ajouter checks/index partiel, fresh/snapshot tests.
4. Écrire registre droits et tests deny-by-default.
5. Implémenter inventory/dry-run avec golden reports.
6. Implémenter apply/verify par lots et tests interruption/reprise.
7. Intégrer M0A scopes parent, tests IDOR et non-régression V1.
8. Enregistrer preuves et marquer gate identité seulement après revue.

Commits atomiques recommandés : schema, constraints, inventory/plan, apply/verify, policies/IDOR, evidence.

## Rollback et réparation

Erreur avant apply : aucun write. Erreur de lot : transaction du lot rollback, reprise par checksum. Mauvaise relation candidate : `REJECTED`; mauvaise relation vérifiée : `REVOKED` avec actor/motif, restauration d'accès seulement par nouvelle relation vérifiée. Tables/colonnes conservées, flags parent V2 fermés. Aucune suppression de `parentId`, aucun rollback V1 compensatoire.

GO : relation M:N, pipeline idempotent/reprenable, zéro auto-verify, scopes parent verts, V1 inchangé. NO-GO : enrollment M1 non vide sans plan, rapprochement email, fusion compte, write dual ou relation VERIFIED sans preuve humaine.
