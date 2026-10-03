BEGIN;

CREATE TYPE "AccountSecurityEventKind" AS ENUM ('PASSWORD_CHANGED');

CREATE TABLE "account_security_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AccountSecurityEventKind" NOT NULL,
  "sessionVersion" INTEGER NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_security_events_session_version_positive" CHECK ("sessionVersion" > 0),
  CONSTRAINT "account_security_events_correlation_uuid" CHECK (
    "correlationId" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ),
  CONSTRAINT "account_security_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "account_security_events_userId_sessionVersion_key"
  ON "account_security_events"("userId", "sessionVersion");
CREATE INDEX "account_security_events_correlationId_idx" ON "account_security_events"("correlationId");

CREATE FUNCTION prevent_account_security_event_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ACCOUNT_SECURITY_EVENT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_security_events_append_only
  BEFORE UPDATE OR DELETE ON "account_security_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_account_security_event_mutation();

COMMIT;
