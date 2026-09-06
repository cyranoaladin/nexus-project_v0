-- Additive only: existing identities and contact numbers remain unchanged.
CREATE TYPE "ParentPhoneState" AS ENUM ('NONE', 'RESERVED', 'VERIFIED');
CREATE TYPE "ParentPhonePurpose" AS ENUM ('ACTIVATION', 'RECOVERY');
CREATE TYPE "SchoolingStatus" AS ENUM ('SCHOOL_ENROLLED', 'INDIVIDUAL');
ALTER TYPE "CanonicalJobType" ADD VALUE IF NOT EXISTS 'WHATSAPP_SEND';
ALTER TABLE "users"
 ADD COLUMN "parentPhoneState" "ParentPhoneState" NOT NULL DEFAULT 'NONE',
 ADD COLUMN "parentPhoneVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
 ADD COLUMN "registrationCompletedAt" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN "schoolingStatus" "SchoolingStatus";
CREATE TABLE "parent_phone_challenges" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL,
 "phoneNormalized" TEXT NOT NULL,
 "phoneVersion" INTEGER NOT NULL,
 "purpose" "ParentPhonePurpose" NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "consumedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "parent_phone_challenges_tokenHash_key" ON "parent_phone_challenges"("tokenHash");
CREATE INDEX "parent_phone_challenges_userId_createdAt_idx" ON "parent_phone_challenges"("userId", "createdAt");
CREATE UNIQUE INDEX "parent_phone_reserved_identity_key" ON "users"("phoneNormalized")
 WHERE "role" = 'PARENT' AND "mergedIntoUserId" IS NULL AND "parentPhoneState" IN ('RESERVED', 'VERIFIED');
ALTER TABLE "users" ADD CONSTRAINT "parent_phone_identity_consistent" CHECK (
 ("parentPhoneState" = 'NONE' AND "phoneVerifiedAt" IS NULL) OR
 ("role" = 'PARENT' AND "mergedIntoUserId" IS NULL AND "phoneNormalized" IS NOT NULL AND
  (("parentPhoneState" = 'RESERVED' AND "phoneVerifiedAt" IS NULL) OR
   ("parentPhoneState" = 'VERIFIED' AND "phoneVerifiedAt" IS NOT NULL)))
);
-- Covers all historical writers, not just the new enrollment service.
CREATE FUNCTION invalidate_parent_phone_identity() RETURNS TRIGGER AS $$
BEGIN
 IF NEW."email" IS DISTINCT FROM OLD."email" THEN
   NEW."emailVerifiedAt" := NULL;
 END IF;
 IF NEW."phoneNormalized" IS DISTINCT FROM OLD."phoneNormalized"
 OR NEW."role" IS DISTINCT FROM OLD."role"
 OR NEW."mergedIntoUserId" IS DISTINCT FROM OLD."mergedIntoUserId" THEN
   NEW."parentPhoneState" := 'NONE';
   NEW."phoneVerifiedAt" := NULL;
   NEW."parentPhoneVersion" := OLD."parentPhoneVersion" + 1;
   NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
   UPDATE "parent_phone_challenges" SET "revokedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = OLD."id" AND "consumedAt" IS NULL AND "revokedAt" IS NULL;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER users_invalidate_parent_phone_identity
 BEFORE UPDATE OF "phoneNormalized", "role", "mergedIntoUserId", "email" ON "users"
 FOR EACH ROW EXECUTE FUNCTION invalidate_parent_phone_identity();
