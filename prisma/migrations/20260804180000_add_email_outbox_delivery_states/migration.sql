-- Additive delivery states for durable SMTP intents. Existing jobs and
-- application releases continue to ignore these values safely.
ALTER TYPE "CanonicalOutboxStatus" ADD VALUE IF NOT EXISTS 'AMBIGUOUS';
ALTER TYPE "CanonicalOutboxStatus" ADD VALUE IF NOT EXISTS 'RETRY_SCHEDULED';
ALTER TYPE "CanonicalOutboxStatus" ADD VALUE IF NOT EXISTS 'FAILED_FINAL';

ALTER TYPE "CanonicalJobType" ADD VALUE IF NOT EXISTS 'SEND_EMAIL';
