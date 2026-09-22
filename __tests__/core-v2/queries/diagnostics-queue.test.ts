/**
 * `projectDiagnosticQueueState` — pure state machine deciding which single
 * queue bucket a submission belongs to. Exhaustive over the real enum
 * combinations (never re-derived differently by the API route or the UI).
 */
import { projectDiagnosticQueueState } from '@/lib/core-v2/queries/diagnostics-queue';

function row(overrides: {
  submissionStatus?: 'RECEIVED' | 'READABLE' | 'ANALYZED' | 'REJECTED';
  processingStatus?: 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'NO_EXTRACTABLE_TEXT' | 'EXTRACTION_FAILED' | null;
  draftStatus?: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | null;
}) {
  return {
    submissionStatus: overrides.submissionStatus ?? 'RECEIVED',
    processingStatus: overrides.processingStatus ?? null,
    draftStatus: overrides.draftStatus ?? null,
  };
}

describe('projectDiagnosticQueueState', () => {
  test('no processing row yet → NOT_PROCESSED, regardless of submission status (unless REJECTED)', () => {
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'RECEIVED' }))).toBe('NOT_PROCESSED');
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'READABLE' }))).toBe('NOT_PROCESSED');
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'ANALYZED' }))).toBe('NOT_PROCESSED');
  });

  test('submission REJECTED → FAILED, even if a processing row somehow exists', () => {
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'REJECTED' }))).toBe('FAILED');
    expect(
      projectDiagnosticQueueState({ submissionStatus: 'REJECTED', processingStatus: 'EXTRACTED', draftStatus: 'PUBLISHED' }),
    ).toBe('FAILED');
  });

  test('processing QUEUED or EXTRACTING → PROCESSING', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'QUEUED' }))).toBe('PROCESSING');
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTING' }))).toBe('PROCESSING');
  });

  test('processing EXTRACTION_FAILED or NO_EXTRACTABLE_TEXT → FAILED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTION_FAILED' }))).toBe('FAILED');
    expect(projectDiagnosticQueueState(row({ processingStatus: 'NO_EXTRACTABLE_TEXT' }))).toBe('FAILED');
  });

  test('EXTRACTED with no draft yet → READY_FOR_REVIEW', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: null }))).toBe(
      'READY_FOR_REVIEW',
    );
  });

  test('EXTRACTED + draft DRAFT → READY_FOR_REVIEW', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'DRAFT' }))).toBe(
      'READY_FOR_REVIEW',
    );
  });

  test('EXTRACTED + draft VALIDATED → VALIDATED_UNPUBLISHED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'VALIDATED' }))).toBe(
      'VALIDATED_UNPUBLISHED',
    );
  });

  test('EXTRACTED + draft PUBLISHED → PUBLISHED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'PUBLISHED' }))).toBe(
      'PUBLISHED',
    );
  });
});

describe('isActionRequired', () => {
  it('is true for NOT_PROCESSED, READY_FOR_REVIEW, VALIDATED_UNPUBLISHED, FAILED — false for PROCESSING and PUBLISHED', async () => {
    const { isActionRequiredState } = await import('@/lib/core-v2/queries/diagnostics-queue');
    expect(isActionRequiredState('NOT_PROCESSED')).toBe(true);
    expect(isActionRequiredState('READY_FOR_REVIEW')).toBe(true);
    expect(isActionRequiredState('VALIDATED_UNPUBLISHED')).toBe(true);
    expect(isActionRequiredState('FAILED')).toBe(true);
    expect(isActionRequiredState('PROCESSING')).toBe(false);
    expect(isActionRequiredState('PUBLISHED')).toBe(false);
  });
});
