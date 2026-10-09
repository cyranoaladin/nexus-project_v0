-- Additive, fail-closed ownership state. Legacy rows remain PENDING; roster
-- approval is not membership verification. No source relation is deleted.
BEGIN;
CREATE TYPE "HouseholdMembershipStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');
ALTER TABLE "household_parents"
  ADD COLUMN "verificationStatus" "HouseholdMembershipStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "verificationEvidenceDigest" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "household_parents" ADD CONSTRAINT "household_parents_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "household_parents" ADD CONSTRAINT "household_membership_verification_state"
  CHECK (
    "revision" >= 0 AND
    (("verificationStatus" = 'PENDING' AND "verifiedAt" IS NULL AND "verifiedById" IS NULL
       AND "verificationEvidenceDigest" IS NULL AND "revokedAt" IS NULL)
     OR ("verificationStatus" = 'VERIFIED' AND "revision" > 0 AND "verifiedAt" IS NOT NULL AND "verifiedById" IS NOT NULL
       AND "verificationEvidenceDigest" IS NOT NULL AND "verificationEvidenceDigest" ~ '^[a-f0-9]{64}$' AND "revokedAt" IS NULL)
     OR ("verificationStatus" = 'REVOKED' AND "revision" > 0 AND "revokedAt" IS NOT NULL AND NOT "isPrimaryContact"
       AND (("verifiedAt" IS NULL AND "verifiedById" IS NULL AND "verificationEvidenceDigest" IS NULL)
         OR ("verifiedAt" IS NOT NULL AND "verifiedById" IS NOT NULL AND "verificationEvidenceDigest" IS NOT NULL
           AND "verificationEvidenceDigest" ~ '^[a-f0-9]{64}$' AND "revokedAt" >= "verifiedAt"))))
  );

COMMIT;
