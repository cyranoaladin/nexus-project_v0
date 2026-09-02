import { createHash } from 'node:crypto';
import { isKnownCourseKey } from '../../lib/curriculum/catalog';

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
    | 'INVALID_EXISTING_COURSE'
    | 'UNIQUE_CANONICAL_EVIDENCE'
    | 'AMBIGUOUS_CANONICAL_EVIDENCE'
    | 'CONFLICTING_CANONICAL_EVIDENCE'
    | 'UNIQUE_ACADEMIC_SUBJECT'
    | 'NO_PROVABLE_CONTEXT';
}

export interface LegacyContextConsultedEvidence {
  readonly canonical: readonly Readonly<{
    source: 'SKILL' | 'RESOURCE';
    sourceId: string;
    candidates: readonly string[];
  }>[];
  readonly academic: readonly Readonly<{
    academicKey: string;
    candidates: readonly string[];
  }>[];
}

export interface LegacyContextClassification {
  readonly decision: LegacyContextDecision;
  readonly consultedEvidence: LegacyContextConsultedEvidence;
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
  return classifyLegacyConversationContextWithEvidence(row, evidence).decision;
}

function classification(
  decision: LegacyContextDecision,
  canonical: LegacyContextConsultedEvidence['canonical'],
  academic: LegacyContextConsultedEvidence['academic'] = [],
): LegacyContextClassification {
  return Object.freeze({
    decision: Object.freeze({ ...decision }),
    consultedEvidence: Object.freeze({
      canonical: Object.freeze(canonical.map((entry) => Object.freeze({
        ...entry,
        candidates: Object.freeze([...entry.candidates]),
      }))),
      academic: Object.freeze(academic.map((entry) => Object.freeze({
        ...entry,
        candidates: Object.freeze([...entry.candidates]),
      }))),
    }),
  });
}

export function classifyLegacyConversationContextWithEvidence(
  row: LegacyConversationContextRow,
  evidence: LegacyContextEvidence,
): LegacyContextClassification {
  if (row.courseKey) {
    if (!isKnownCourseKey(row.courseKey)) {
      return classification({
        classification: 'MANUAL_REVIEW_REQUIRED',
        courseKey: null,
        reasonCode: 'INVALID_EXISTING_COURSE',
      }, []);
    }
    return classification({
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: row.courseKey,
      reasonCode: 'EXISTING_COURSE',
    }, []);
  }

  const skillCandidates = row.skillId
    ? normalizedCandidates(evidence.skillCourseCandidates.get(row.skillId))
    : [];
  const resourceCandidates = row.resourceId
    ? normalizedCandidates(evidence.resourceCourseCandidates.get(row.resourceId))
    : [];
  const canonicalEvidence: LegacyContextConsultedEvidence['canonical'] = [
    ...(row.skillId ? [{
      source: 'SKILL' as const,
      sourceId: row.skillId,
      candidates: skillCandidates,
    }] : []),
    ...(row.resourceId ? [{
      source: 'RESOURCE' as const,
      sourceId: row.resourceId,
      candidates: resourceCandidates,
    }] : []),
  ];
  if (skillCandidates.length > 1 || resourceCandidates.length > 1) {
    return classification({
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'AMBIGUOUS_CANONICAL_EVIDENCE',
    }, canonicalEvidence);
  }

  const canonicalCandidates = normalizedCandidates([
    ...skillCandidates,
    ...resourceCandidates,
  ]);
  if (canonicalCandidates.length > 1) {
    return classification({
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'CONFLICTING_CANONICAL_EVIDENCE',
    }, canonicalEvidence);
  }
  if (canonicalCandidates.length === 1) {
    return classification({
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: canonicalCandidates[0],
      reasonCode: 'UNIQUE_CANONICAL_EVIDENCE',
    }, canonicalEvidence);
  }

  const academicKey = `${row.studentId}:${row.subject ?? ''}`;
  const academicCandidates = normalizedCandidates(
    evidence.academicSubjectCandidates.get(academicKey),
  );
  const academicEvidence = [{ academicKey, candidates: academicCandidates }];
  if (academicCandidates.length === 1) {
    return classification({
      classification: 'DETERMINISTIC_BACKFILL',
      courseKey: academicCandidates[0],
      reasonCode: 'UNIQUE_ACADEMIC_SUBJECT',
    }, canonicalEvidence, academicEvidence);
  }
  if (academicCandidates.length > 1) {
    return classification({
      classification: 'MANUAL_REVIEW_REQUIRED',
      courseKey: null,
      reasonCode: 'AMBIGUOUS_CANONICAL_EVIDENCE',
    }, canonicalEvidence, academicEvidence);
  }
  return classification({
    classification: 'ARCHIVED_NON_RESUMABLE',
    courseKey: null,
    reasonCode: 'NO_PROVABLE_CONTEXT',
  }, canonicalEvidence, academicEvidence);
}

export type { LegacyContextEvidence as LegacyContextEvidenceContract };
