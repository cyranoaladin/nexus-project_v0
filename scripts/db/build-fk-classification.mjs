#!/usr/bin/env node
// One-off generator: turns /tmp/fk_final_ground_truth.tsv (real pg_constraint
// output) plus a manual classification map into
// __tests__/architecture/account-deletion-fk-classification.json.
// Not part of the build; run once by hand when the ground truth changes.
import { readFileSync, writeFileSync } from 'node:fs';

const rows = readFileSync('/tmp/fk_final_ground_truth.tsv', 'utf8')
  .trim()
  .split('\n')
  .map((line) => {
    const [conname, childTable, parentTable, onDelete] = line.split('\t');
    return { conname, childTable: childTable.replace(/"/g, ''), parentTable, onDelete };
  });

// category: PURE_MEMBERSHIP_CASCADE_ALLOWED | EPHEMERAL_CASCADE_ALLOWED |
//           HISTORICAL_RESTRICT | FINANCIAL_RESTRICT | AUDIT_RETAIN
const CATEGORY = {
  CoachAvailability_coachId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  SessionBooking_coachId_fkey: 'HISTORICAL_RESTRICT',
  SessionBooking_coachProfileId_fkey: 'HISTORICAL_RESTRICT',
  SessionBooking_parentId_fkey: 'HISTORICAL_RESTRICT',
  SessionBooking_studentId_fkey: 'HISTORICAL_RESTRICT',
  SessionBooking_studentProfileId_fkey: 'HISTORICAL_RESTRICT',
  SessionNotification_userId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_activity_attempts_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_cockpit_profiles_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_conversation_turns_actorUserId_fkey: 'AUDIT_RETAIN',
  aria_conversation_turns_cancellationActor_fkey: 'AUDIT_RETAIN',
  aria_conversation_turns_subjectStudentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_conversations_studentId_fkey: 'HISTORICAL_RESTRICT',
  aria_feedbacks_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_learning_evidence_studentId_fkey: 'HISTORICAL_RESTRICT',
  aria_learning_profiles_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  aria_workshop_attendees_attendanceMarkedById_fkey: 'AUDIT_RETAIN',
  aria_workshop_attendees_studentId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  aria_workshop_sessions_coachProfileId_fkey: 'HISTORICAL_RESTRICT',
  aria_workshop_sessions_createdById_fkey: 'AUDIT_RETAIN',
  assessments_studentId_fkey: 'HISTORICAL_RESTRICT',
  bilans_coachId_fkey: 'HISTORICAL_RESTRICT',
  bilans_reviewedById_fkey: 'AUDIT_RETAIN',
  bilans_studentId_fkey: 'HISTORICAL_RESTRICT',
  candidate_diagnostic_audit_logs_actorId_fkey: 'AUDIT_RETAIN',
  candidate_diagnostic_consents_parentUserId_fkey: 'AUDIT_RETAIN',
  candidate_diagnostic_consents_studentId_fkey: 'HISTORICAL_RESTRICT',
  candidate_diagnostic_documents_uploadedById_fkey: 'AUDIT_RETAIN',
  candidate_diagnostics_createdById_fkey: 'AUDIT_RETAIN',
  candidate_diagnostics_studentId_fkey: 'HISTORICAL_RESTRICT',
  canonical_assessment_attempts_enteredById_fkey: 'AUDIT_RETAIN',
  canonical_assessment_attempts_studentId_fkey: 'HISTORICAL_RESTRICT',
  canonical_notification_outbox_recipientUserId_fkey: 'AUDIT_RETAIN',
  canonical_parent_student_links_parentUserId_fkey: 'HISTORICAL_RESTRICT',
  canonical_parent_student_links_studentId_fkey: 'HISTORICAL_RESTRICT',
  canonical_report_artifacts_studentId_fkey: 'HISTORICAL_RESTRICT',
  canonical_report_regenerations_requestedById_fkey: 'AUDIT_RETAIN',
  canonical_report_reviews_coachId_fkey: 'HISTORICAL_RESTRICT',
  canonical_report_reviews_reviewerId_fkey: 'AUDIT_RETAIN',
  canonical_report_share_links_createdById_fkey: 'AUDIT_RETAIN',
  canonical_report_share_links_recipientUserId_fkey: 'AUDIT_RETAIN',
  canonical_report_transmissions_confirmedById_fkey: 'AUDIT_RETAIN',
  canonical_report_transmissions_recipientUserId_fkey: 'AUDIT_RETAIN',
  canonical_teacher_brief_annotations_authorId_fkey: 'AUDIT_RETAIN',
  canonical_teacher_briefs_createdById_fkey: 'AUDIT_RETAIN',
  canonical_teacher_briefs_reviewedById_fkey: 'AUDIT_RETAIN',
  clictopay_transactions_userId_fkey: 'FINANCIAL_RESTRICT',
  coach_notes_coachId_fkey: 'HISTORICAL_RESTRICT',
  coach_notes_studentId_fkey: 'HISTORICAL_RESTRICT',
  coach_profiles_userId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  coach_student_assignments_assignedById_fkey: 'AUDIT_RETAIN',
  coach_student_assignments_coachId_fkey: 'HISTORICAL_RESTRICT',
  coach_student_assignments_studentId_fkey: 'HISTORICAL_RESTRICT',
  copy_submissions_coachId_fkey: 'HISTORICAL_RESTRICT',
  copy_submissions_studentId_fkey: 'HISTORICAL_RESTRICT',
  credit_transactions_studentId_fkey: 'FINANCIAL_RESTRICT',
  eaf_preparation_reports_coachId_fkey: 'HISTORICAL_RESTRICT',
  eaf_preparation_reports_studentId_fkey: 'HISTORICAL_RESTRICT',
  eam_progress_user_id_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  entitlements_userId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  family_requests_processedById_fkey: 'AUDIT_RETAIN',
  family_requests_requestingParentProfileId_fkey: 'HISTORICAL_RESTRICT',
  generated_pedagogical_reports_coachId_fkey: 'HISTORICAL_RESTRICT',
  generated_pedagogical_reports_studentId_fkey: 'HISTORICAL_RESTRICT',
  maths_progress_userId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  messages_receiverId_fkey: 'HISTORICAL_RESTRICT',
  messages_senderId_fkey: 'HISTORICAL_RESTRICT',
  nsi_practice_progress_userId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  parent_phone_challenges_userId_fkey: 'AUDIT_RETAIN',
  parent_profiles_userId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  payments_userId_fkey: 'FINANCIAL_RESTRICT',
  pedagogical_reports_coachId_fkey: 'HISTORICAL_RESTRICT',
  pedagogical_reports_studentId_fkey: 'HISTORICAL_RESTRICT',
  planning_override_audits_actorId_fkey: 'AUDIT_RETAIN',
  planning_series_coachProfileId_fkey: 'HISTORICAL_RESTRICT',
  planning_series_createdById_fkey: 'AUDIT_RETAIN',
  planning_series_studentProfileId_fkey: 'HISTORICAL_RESTRICT',
  planning_studio_documents_updatedById_fkey: 'AUDIT_RETAIN',
  planning_studio_revisions_createdById_fkey: 'AUDIT_RETAIN',
  profils_candidats_studentId_fkey: 'HISTORICAL_RESTRICT',
  progression_history_studentId_fkey: 'HISTORICAL_RESTRICT',
  projection_history_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  quotes_studentId_fkey: 'FINANCIAL_RESTRICT',
  session_reports_coachId_fkey: 'HISTORICAL_RESTRICT',
  session_reports_studentId_fkey: 'HISTORICAL_RESTRICT',
  sessions_coachId_fkey: 'HISTORICAL_RESTRICT',
  sessions_studentId_fkey: 'HISTORICAL_RESTRICT',
  stage_bilans_coachId_fkey: 'HISTORICAL_RESTRICT',
  stage_bilans_studentId_fkey: 'HISTORICAL_RESTRICT',
  stage_coaches_coachId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  stage_documents_uploadedById_fkey: 'AUDIT_RETAIN',
  stage_reservations_studentId_fkey: 'HISTORICAL_RESTRICT',
  stage_sessions_coachId_fkey: 'HISTORICAL_RESTRICT',
  student_academic_enrollments_studentId_fkey: 'HISTORICAL_RESTRICT',
  student_academic_enrollments_verifiedById_fkey: 'AUDIT_RETAIN',
  student_badges_studentId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  student_reports_coachId_fkey: 'HISTORICAL_RESTRICT',
  student_reports_studentId_fkey: 'HISTORICAL_RESTRICT',
  students_parentId_fkey: 'HISTORICAL_RESTRICT',
  students_userId_fkey: 'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  subscription_requests_studentId_fkey: 'FINANCIAL_RESTRICT',
  subscriptions_studentId_fkey: 'FINANCIAL_RESTRICT',
  survival_progress_studentId_fkey: 'EPHEMERAL_CASCADE_ALLOWED',
  trajectories_studentId_fkey: 'HISTORICAL_RESTRICT',
  user_documents_uploadedById_fkey: 'AUDIT_RETAIN',
  user_documents_userId_fkey: 'HISTORICAL_RESTRICT',
  users_mergedIntoUserId_fkey: 'AUDIT_RETAIN',
};

const missing = rows.filter((r) => !CATEGORY[r.conname]);
if (missing.length) {
  console.error('UNCLASSIFIED:', missing.map((r) => r.conname));
  process.exit(1);
}

const out = rows
  .map((r) => ({ ...r, category: CATEGORY[r.conname] }))
  .sort((a, b) => a.conname.localeCompare(b.conname));

writeFileSync(
  '__tests__/architecture/account-deletion-fk-classification.json',
  JSON.stringify(out, null, 2) + '\n',
);
console.log(`Wrote ${out.length} classified constraints.`);
