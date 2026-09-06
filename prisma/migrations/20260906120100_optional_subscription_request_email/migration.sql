-- A parent may authenticate with a verified telephone without an email.
-- Preserve all existing contact history; do not fabricate an email address.
ALTER TABLE "subscription_requests" ALTER COLUMN "requestedByEmail" DROP NOT NULL;
