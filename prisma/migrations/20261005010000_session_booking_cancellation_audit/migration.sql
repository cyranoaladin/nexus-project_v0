BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Additive: no historical event or actor ownership is reconstructed.
CREATE TABLE "session_booking_cancellation_audits" (
  "id" TEXT NOT NULL,
  "sessionBookingId" TEXT NOT NULL,
  "actorUserId" VARCHAR(128) NOT NULL,
  "actorRole" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'BOOKING_CANCELLED',
  "previousStatus" "SessionStatus" NOT NULL,
  "nextStatus" "SessionStatus" NOT NULL DEFAULT 'CANCELLED',
  "reason" VARCHAR(500) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_booking_cancellation_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_cancellation_transition" CHECK (
    "previousStatus" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') AND "nextStatus" = 'CANCELLED'
    AND "action" IN ('BOOKING_CANCELLED', 'SERIES_CANCELLED', 'SERIES_REVISED')
  ),
  CONSTRAINT "session_cancellation_actor" CHECK (length("actorUserId") BETWEEN 1 AND 128 AND "actorRole" IN ('ELEVE', 'COACH', 'ASSISTANTE', 'ADMIN')),
  CONSTRAINT "session_cancellation_reason" CHECK (length(btrim("reason")) BETWEEN 1 AND 500),
  CONSTRAINT "session_cancellation_command" CHECK (length("requestKey") BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "session_booking_cancellation_audits_requestKey_key" ON "session_booking_cancellation_audits"("requestKey");
CREATE INDEX "session_booking_cancellation_audits_booking_time_idx" ON "session_booking_cancellation_audits"("sessionBookingId", "occurredAt");
CREATE INDEX "session_booking_cancellation_audits_actor_time_idx" ON "session_booking_cancellation_audits"("actorUserId", "occurredAt");
ALTER TABLE "session_booking_cancellation_audits" ADD CONSTRAINT "session_booking_cancellation_audits_sessionBookingId_fkey"
  FOREIGN KEY ("sessionBookingId") REFERENCES "SessionBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION reject_session_booking_cancellation_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SESSION_BOOKING_CANCELLATION_AUDIT_APPEND_ONLY' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER session_booking_cancellation_audit_append_only
BEFORE UPDATE OR DELETE ON "session_booking_cancellation_audits"
FOR EACH ROW EXECUTE FUNCTION reject_session_booking_cancellation_audit_mutation();
COMMIT;
