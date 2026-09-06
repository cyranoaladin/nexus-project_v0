-- Additive replacement: retain the deployed phone invalidation trigger and all its invariants.
-- Preserve account/history data; the cutover below only revokes unprovable pending email links.
CREATE OR REPLACE FUNCTION invalidate_parent_phone_identity() RETURNS TRIGGER AS $$
BEGIN
 IF NEW."email" IS DISTINCT FROM OLD."email" THEN
   NEW."emailVerifiedAt" := NULL;
   IF OLD."role" = 'PARENT' OR NEW."role" = 'PARENT' THEN
     -- Old links prove possession of the previous address, never the new one.
     -- Preserve a distinct hash when a writer issues a fresh link atomically.
     IF NEW."activationToken" IS NOT DISTINCT FROM OLD."activationToken" THEN
       NEW."activationToken" := NULL;
       NEW."activationExpiry" := NULL;
     END IF;
     NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
   END IF;
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

-- Legacy email tokens contain no destination snapshot. Their provenance cannot
-- be established after a past email change. Revoke these pending parent links
-- once at cutover; staff or the public resend flow must issue a fresh link.
-- Activated accounts, other roles, WhatsApp challenges and all family/history
-- records are untouched. Token-only UPDATE does not invoke the contact trigger.
UPDATE "users"
SET "activationToken" = NULL, "activationExpiry" = NULL
WHERE "role" = 'PARENT'
  AND "activatedAt" IS NULL
  AND "activationToken" IS NOT NULL;
