-- Foundation hardening §13 (speculative-field audit): drops
-- CoachStudentCourseAssignment.assignmentType, added in the baseline with
-- zero usage anywhere in Core v2 — no repository function read, wrote, or
-- validated it, no test exercised it, and the partial unique index never
-- included it ("kept if a real business need survives the audit").
--
-- The underlying need IS real, confirmed by cross-referencing live Core v1
-- production: CoachStudentAssignment.assignmentType is actively used there,
-- with its own active-uniqueness index scoped to include it. But nothing in
-- this foundation implements or tests that workflow yet — dropped here
-- rather than carried forward unwired; re-add it, index-scoped and
-- repository-validated, in whichever future PR actually implements
-- primary/secondary coach assignment.
--
-- CreateTable/AlterTable is the exact output of
-- `prisma migrate diff --from-url $CORE_V2_DATABASE_URL --to-schema-datamodel
-- core-v2/prisma/schema.prisma --script`, so this migration produces zero
-- drift against the schema.
ALTER TABLE "coach_student_course_assignments" DROP COLUMN "assignmentType";

DROP TYPE "AssignmentType";
