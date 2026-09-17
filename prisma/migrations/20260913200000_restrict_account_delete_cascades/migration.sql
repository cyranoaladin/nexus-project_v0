-- Zero-debt go-live audit, finding DELETE-1/DELETE-2: a routine one-click
-- Admin/Assistante delete of a User (DELETE /api/admin/users,
-- DELETE /api/assistante/coaches/manage/[id]) previously cascade-deleted
-- real billing history (Subscription), academic history
-- (StudentAcademicEnrollment), ARIA conversation/assessment history
-- (AriaConversation, LearningEvidence), session booking history
-- (SessionBooking, via its legacy studentId/coachId FKs — which defeated
-- the canonical studentProfileId/coachProfileId FKs' own, correct
-- SetNull behavior), coach-student assignment history
-- (CoachStudentAssignment), and uploaded documents (UserDocument).
--
-- This migration changes those 11 foreign keys from ON DELETE CASCADE to
-- ON DELETE RESTRICT. A delete of a User/Student/CoachProfile that still
-- has any of this real history now fails loudly (Postgres foreign-key
-- violation, surfaced by the app as a 409) instead of silently destroying
-- it. Deleting a genuinely empty account (never had a subscription,
-- enrollment, session, assignment, document, or ARIA activity) is
-- unaffected — this is exactly the shape of account the existing
-- lib/auth/pending-account-lifecycle.ts purgeGraph() path already
-- operates on for never-activated accounts, which this migration does
-- not change.
--
-- Pure behavior-change migration: does not touch any existing row or
-- column, only the ON DELETE action of already-existing foreign keys —
-- safe to apply against any current data (EXPAND/BACKWARD_COMPATIBLE per
-- the same classification the other September 2026 migrations use).

-- DropForeignKey
ALTER TABLE "student_academic_enrollments" DROP CONSTRAINT "student_academic_enrollments_studentId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_studentId_fkey";

-- DropForeignKey
ALTER TABLE "aria_learning_evidence" DROP CONSTRAINT "aria_learning_evidence_studentId_fkey";

-- DropForeignKey
ALTER TABLE "aria_conversations" DROP CONSTRAINT "aria_conversations_studentId_fkey";

-- DropForeignKey
ALTER TABLE "SessionBooking" DROP CONSTRAINT "SessionBooking_studentId_fkey";

-- DropForeignKey
ALTER TABLE "SessionBooking" DROP CONSTRAINT "SessionBooking_coachId_fkey";

-- DropForeignKey
ALTER TABLE "user_documents" DROP CONSTRAINT "user_documents_userId_fkey";

-- DropForeignKey
ALTER TABLE "coach_notes" DROP CONSTRAINT "coach_notes_studentId_fkey";

-- DropForeignKey
ALTER TABLE "coach_notes" DROP CONSTRAINT "coach_notes_coachId_fkey";

-- DropForeignKey
ALTER TABLE "coach_student_assignments" DROP CONSTRAINT "coach_student_assignments_coachId_fkey";

-- DropForeignKey
ALTER TABLE "coach_student_assignments" DROP CONSTRAINT "coach_student_assignments_studentId_fkey";

-- AddForeignKey
ALTER TABLE "student_academic_enrollments" ADD CONSTRAINT "student_academic_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_learning_evidence" ADD CONSTRAINT "aria_learning_evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_conversations" ADD CONSTRAINT "aria_conversations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_student_assignments" ADD CONSTRAINT "coach_student_assignments_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_student_assignments" ADD CONSTRAINT "coach_student_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

