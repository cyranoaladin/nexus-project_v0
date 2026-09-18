-- Zero-debt go-live audit, #273 FK inventory hardening (post-DELETE-1..5).
--
-- Building the exhaustive, DB-ground-truth FK manifest for #273 surfaced 4
-- relations into User/Student that had never been explicitly reviewed for
-- delete-cascade safety at all (they simply predate this audit and were
-- never touched by 20260913200000/210000/220000/230000's targeted fixes):
--
--   entitlements_userId_fkey        — what a user was ever granted/bought
--                                      (product, tier, invoice/subscription
--                                      linkage, suspension/revocation
--                                      history). Losing this on delete
--                                      erases the platform's own record of
--                                      what access it granted and revoked —
--                                      exactly the kind of history a billing
--                                      dispute needs.
--   maths_progress_userId_fkey      — a student's actual practice history:
--                                      completed/mastered chapters, XP,
--                                      quiz scores, streaks, diagnostic
--                                      results, error tags. Not a cache —
--                                      it IS the record of what the student
--                                      (a minor) did.
--   nsi_practice_progress_userId_fkey / eam_progress_user_id_fkey — same
--                                      shape and same reasoning as
--                                      maths_progress, for the NSI and EAF
--                                      practice tracks.
--
-- Two more relations WERE explicitly reviewed by 20260913230000 (see its
-- own comment) and deliberately left CASCADE as "re-derivable... no
-- independent audit/financial/reporting value" — re-examined here and
-- overridden for two of them specifically:
--
--   projection_history_studentId_fkey — its own column is literally named
--                                      "history": ssnProjected/
--                                      confidenceIndex/modelVersion over
--                                      time. inputSnapshot (the one thing
--                                      that could make a row re-derivable)
--                                      is nullable — often absent — so
--                                      "re-derivable" does not generally
--                                      hold, and the table's entire value
--                                      is the trend it preserves.
--   survival_progress_studentId_fkey  — structurally the same category of
--                                      data as maths_progress (gamified
--                                      exam-prep progress: reflexes/
--                                      phrases/qcm state, a predicted grade
--                                      `notePotentielle`) — being gamified
--                                      is not itself a reason to treat it
--                                      as disposable once maths_progress
--                                      (the same shape of data) is treated
--                                      as real pedagogical history.
--
-- aria_activity_attempts_studentId_fkey, aria_cockpit_profiles_studentId_fkey,
-- aria_feedbacks_studentId_fkey, aria_learning_profiles_studentId_fkey
-- remain CASCADE: re-reviewed here too, and the original reasoning holds —
-- aria_cockpit_profiles/aria_learning_profiles are pure UI preference state
-- (selected/pinned courses, onboarding flags — no history value);
-- aria_feedbacks is a secondary thumbs-up/down signal on ARIA messages
-- whose own conversation is already Restrict-protected
-- (aria_conversations_studentId_fkey); aria_activity_attempts is informal
-- practice-rep data distinct from this codebase's formally graded/reported
-- assessment tracks (assessments, canonical_assessment_attempts, bilans —
-- all already Restrict). See
-- __tests__/architecture/account-deletion-fk-classification.json for the
-- full, machine-checked justification per relation.
--
-- Pure behavior-change migration: does not touch any existing row or
-- column, only the ON DELETE action of already-existing foreign keys —
-- safe to apply against any current data. NOT VALID here, validated
-- separately in 20260914000001 under ShareUpdateExclusiveLock instead of
-- AccessExclusiveLock — same reasoning and measured lock behavior as
-- 20260913230000/230001 (see that migration's comment); no table here is
-- expected to be larger than what was already measured there.

ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_userId_fkey";
ALTER TABLE "maths_progress" DROP CONSTRAINT "maths_progress_userId_fkey";
ALTER TABLE "nsi_practice_progress" DROP CONSTRAINT "nsi_practice_progress_userId_fkey";
ALTER TABLE "eam_progress" DROP CONSTRAINT "eam_progress_user_id_fkey";
ALTER TABLE "projection_history" DROP CONSTRAINT "projection_history_studentId_fkey";
ALTER TABLE "survival_progress" DROP CONSTRAINT "survival_progress_studentId_fkey";

ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "maths_progress" ADD CONSTRAINT "maths_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "nsi_practice_progress" ADD CONSTRAINT "nsi_practice_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "eam_progress" ADD CONSTRAINT "eam_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "projection_history" ADD CONSTRAINT "projection_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "survival_progress" ADD CONSTRAINT "survival_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
