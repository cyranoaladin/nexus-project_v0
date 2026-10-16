import { evaluateDeterministicGate } from './policy.mjs';
import { applicableHumanApproval, classifyRisk } from './risk.mjs';
import { decideSemanticReview } from './semantic.mjs';

const result = (conclusion, reason, fields = {}) => ({ conclusion, reason, ...fields });

/**
 * Pure, fail-closed review decision. Evidence is read by collect.mjs from
 * GitHub and must be collected again after inference, before publication.
 */
export function decideOperationalGate({ evidence, qualifiedModel, outputs } = {}) {
  if (!evidence || !Array.isArray(evidence.files)) return result('failure', 'EVIDENCE_INCOMPLETE');
  const reviewedHeadSha = evidence.reviewedHeadSha;
  const deterministic = evaluateDeterministicGate(evidence);
  if (!deterministic.passed) return result('failure', deterministic.reason, { reviewedHeadSha });
  if (evidence.threadsComplete !== true || evidence.reviewsComplete !== true ||
      !Number.isSafeInteger(evidence.unresolvedReviewThreads) ||
      !Number.isSafeInteger(evidence.applicableChangesRequested)) {
    return result('failure', 'REVIEW_EVIDENCE_INCOMPLETE', { reviewedHeadSha });
  }
  if (evidence.unresolvedReviewThreads !== 0) {
    return result('action_required', 'UNRESOLVED_REVIEW_THREADS', { reviewedHeadSha });
  }
  if (evidence.applicableChangesRequested !== 0) {
    return result('action_required', 'CHANGES_REQUESTED', { reviewedHeadSha });
  }

  const risk = classifyRisk(evidence.files);
  const fields = { reviewedHeadSha, riskClass: risk.classification,
    riskReasons: risk.reasons, humanExceptionRequired: risk.humanExceptionRequired };
  if (risk.classification === 'UNCLASSIFIED') {
    return result('action_required', 'RISK_UNCLASSIFIED', fields);
  }
  if (risk.humanExceptionRequired) {
    const approval = applicableHumanApproval({
      headSha: reviewedHeadSha, reviews: evidence.reviews,
      reviewsComplete: evidence.reviewsComplete,
    });
    if (!approval.approved) return result('action_required', 'HUMAN_APPROVAL_REQUIRED', fields);
  }

  const semantic = decideSemanticReview({ qualifiedModel,
    allowedFiles: evidence.files.map((file) => file.filename), outputs });
  if (!semantic.passed) {
    return result(semantic.reason === 'MODEL_UNQUALIFIED' ||
      semantic.reason === 'MODEL_BLOCKING_FINDING' ? 'action_required' : 'failure',
    semantic.reason, { ...fields, blockingFindings: semantic.blockingFindings });
  }
  return result('success', 'PASS', fields);
}
