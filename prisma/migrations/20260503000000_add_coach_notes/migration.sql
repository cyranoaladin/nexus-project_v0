-- Phase 6: CoachNote — private notes a coach can write about one of their students.
-- Foreign keys reference users(id) so RBAC checks can join with session_bookings.

CREATE TABLE IF NOT EXISTS "coach_notes" (
    "id"        TEXT          NOT NULL,
    "studentId" TEXT          NOT NULL,
    "coachId"   TEXT          NOT NULL,
    "body"      TEXT          NOT NULL,
    "pinned"    BOOLEAN       NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "coach_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "coach_notes_studentId_idx"
    ON "coach_notes" ("studentId");

CREATE INDEX IF NOT EXISTS "coach_notes_coachId_idx"
    ON "coach_notes" ("coachId");

CREATE INDEX IF NOT EXISTS "coach_notes_studentId_pinned_idx"
    ON "coach_notes" ("studentId", "pinned");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_notes_studentId_fkey'
  ) THEN
    ALTER TABLE "coach_notes"
      ADD CONSTRAINT "coach_notes_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_notes_coachId_fkey'
  ) THEN
    ALTER TABLE "coach_notes"
      ADD CONSTRAINT "coach_notes_coachId_fkey"
      FOREIGN KEY ("coachId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
