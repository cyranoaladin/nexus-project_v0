BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Additive: existing leads/reservations remain unchanged. No historical audit is invented.
CREATE TABLE "stage_reservation_decision_audits" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "nextStatus" TEXT NOT NULL,
  "previousRichStatus" "StageReservationStatus",
  "nextRichStatus" "StageReservationStatus" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stage_reservation_decision_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stage_decision_allowed_transition" CHECK (
    "action" = 'LEAD_DECLINED' AND "previousStatus" IN ('PENDING', 'PENDING_BANK_TRANSFER') AND "nextStatus" = 'CANCELLED'
    AND ("previousRichStatus" IS NULL OR "previousRichStatus" = 'PENDING') AND "nextRichStatus" = 'CANCELLED'
  ),
  CONSTRAINT "stage_decision_request_key_bound" CHECK (length("requestKey") BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "stage_reservation_decision_audits_requestKey_key" ON "stage_reservation_decision_audits"("requestKey");
CREATE INDEX "stage_reservation_decision_audits_reservationId_occurredAt_idx" ON "stage_reservation_decision_audits"("reservationId", "occurredAt");
CREATE INDEX "stage_reservation_decision_audits_actorUserId_occurredAt_idx" ON "stage_reservation_decision_audits"("actorUserId", "occurredAt");
ALTER TABLE "stage_reservation_decision_audits" ADD CONSTRAINT "stage_reservation_decision_audits_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "stage_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stage_reservation_decision_audits" ADD CONSTRAINT "stage_reservation_decision_audits_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION reject_stage_reservation_decision_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'STAGE_RESERVATION_DECISION_AUDIT_APPEND_ONLY' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER stage_reservation_decision_audit_append_only
BEFORE UPDATE OR DELETE ON "stage_reservation_decision_audits"
FOR EACH ROW EXECUTE FUNCTION reject_stage_reservation_decision_audit_mutation();
COMMIT;
