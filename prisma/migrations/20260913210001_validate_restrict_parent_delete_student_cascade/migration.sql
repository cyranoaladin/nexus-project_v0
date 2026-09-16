-- Companion to 20260913210000: validates the NOT VALID constraint added
-- there, in its own transaction/migration so it runs under
-- ShareUpdateExclusiveLock instead of AccessExclusiveLock (measured; see
-- that migration's comment) — safe to run against a production table of
-- any size without blocking concurrent reads/writes.

ALTER TABLE "students" VALIDATE CONSTRAINT "students_parentId_fkey";
