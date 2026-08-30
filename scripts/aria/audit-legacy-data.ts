import { createHash } from 'node:crypto';

export type LegacyClassification =
  | 'DETERMINISTIC_BACKFILL'
  | 'ARCHIVED_NON_RESUMABLE'
  | 'MANUAL_REVIEW_REQUIRED';

export interface LegacyConversationContextRow {
  readonly id: string;
  readonly studentId: string;
  readonly subject: string | null;
  readonly skillId: string | null;
  readonly resourceId: string | null;
  readonly courseKey: string | null;
  readonly contextState: string;
}

export interface LegacyContextEvidence {
  readonly skillCourseCandidates: ReadonlyMap<string, readonly string[]>;
  readonly resourceCourseCandidates: ReadonlyMap<string, readonly string[]>;
  readonly academicSubjectCandidates: ReadonlyMap<string, readonly string[]>;
}

export interface LegacyContextDecision {
  readonly classification: LegacyClassification;
  readonly courseKey: string | null;
  readonly reasonCode:
    | 'EXISTING_COURSE'
    | 'UNIQUE_CANONICAL_EVIDENCE'
    | 'AMBIGUOUS_CANONICAL_EVIDENCE'
    | 'CONFLICTING_CANONICAL_EVIDENCE'
    | 'UNIQUE_ACADEMIC_SUBJECT'
    | 'NO_PROVABLE_CONTEXT';
}

export function stableLegacyFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizedCandidates(candidates: readonly string[] | undefined): readonly string[] {
  return [...new Set(candidates ?? [])].sort();
}

/**
 * Resolve only from evidence that already proves one canonical course.
 * Grade, Terminale and Maths defaults are intentionally absent.
 */
export function classifyLegacyConversationContext(
  row: LegacyConversationContextRow,
  evidence: LegacyContextEvidence,
): LegacyContextDecision {
  if (row.courseKey) {
    return {
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: row.courseKey,
      reasonCode: 'EXISTING_COURSE',
    };
  }

  const skillCandidates = row.skillId
    ? normalizedCandidates(evidence.skillCourseCandidates.get(row.skillId))
    : [];
  const resourceCandidates = row.resourceId
    ? normalizedCandidates(evidence.resourceCourseCandidates.get(row.resourceId))
    : [];
  if (skillCandidates.length > 1 || resourceCandidates.length > 1) {
    return {
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'AMBIGUOUS_CANONICAL_EVIDENCE',
    };
  }

  const canonicalCandidates = normalizedCandidates([
    ...skillCandidates,
    ...resourceCandidates,
  ]);
  if (canonicalCandidates.length > 1) {
    return {
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'CONFLICTING_CANONICAL_EVIDENCE',
    };
  }
  if (canonicalCandidates.length === 1) {
    return {
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: canonicalCandidates[0],
      reasonCode: 'UNIQUE_CANONICAL_EVIDENCE',
    };
  }

  const academicKey = `${row.studentId}:${row.subject ?? ''}`;
  const academicCandidates = normalizedCandidates(
    evidence.academicSubjectCandidates.get(academicKey),
  );
  if (academicCandidates.length === 1) {
    return {
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: academicCandidates[0],
      reasonCode: 'UNIQUE_ACADEMIC_SUBJECT',
    };
  }
  if (academicCandidates.length > 1) {
    return {
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'AMBIGUOUS_CANONICAL_EVIDENCE',
    };
  }
  return {
    classification: 'ARCHIVED_NON_RESUMABLE',
    courseKey: null,
    reasonCode: 'NO_PROVABLE_CONTEXT',
  };
}

export type { LegacyContextEvidence as LegacyContextEvidenceContract };
