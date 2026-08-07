/**
 * Proves the 2 candidate-libre dashboard pages (élève, parent) are dark
 * when CANDIDATE_DIAGNOSTIC_ENABLED is not set to 'true' -- the API route
 * handlers already have this proof in feature-flag-dark.test.ts, but the
 * 2 page components were previously unverified: the code gates correctly
 * (`if (!isCandidateDiagnosticFeatureEnabled()) notFound();` as the first
 * statement, before any portal component renders or params resolve), but
 * nothing caught a regression if that ever silently broke.
 */

const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

const mockDiagnosticPortal = jest.fn((_props?: unknown) => null);
jest.mock('@/components/diagnostics/candidat-libre/DiagnosticPortal', () => ({
  DiagnosticPortal: (props: unknown) => mockDiagnosticPortal(props),
}));

const mockParentDiagnosticPortal = jest.fn((_props?: unknown) => null);
jest.mock('@/components/diagnostics/candidat-libre/ParentDiagnosticPortal', () => ({
  ParentDiagnosticPortal: (props: unknown) => mockParentDiagnosticPortal(props),
}));

import { render } from '@testing-library/react';

import StudentCandidateDiagnosticPage from '@/app/dashboard/eleve/diagnostic-candidat-libre/page';
import ParentCandidateDiagnosticPage from '@/app/dashboard/parent/children/[studentId]/diagnostic-candidat-libre/page';

const originalEnv = process.env.CANDIDATE_DIAGNOSTIC_ENABLED;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
});

afterAll(() => {
  if (originalEnv === undefined) delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
  else process.env.CANDIDATE_DIAGNOSTIC_ENABLED = originalEnv;
});

describe('candidate-libre diagnostic dashboard pages — flag OFF ⇒ dark', () => {

  it('student page calls notFound() and never renders DiagnosticPortal', () => {
    expect(() => StudentCandidateDiagnosticPage()).toThrow('NEXT_NOT_FOUND');
    expect(mockDiagnosticPortal).not.toHaveBeenCalled();
  });

  it('parent page calls notFound() before resolving params or rendering ParentDiagnosticPortal', async () => {
    const params = jest.fn().mockResolvedValue({ studentId: 'student-1' });
    await expect(ParentCandidateDiagnosticPage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockParentDiagnosticPortal).not.toHaveBeenCalled();
  });

  it.each(['false', '', '1', 'TRUE', 'yes'])('student page stays dark for a falsy/garbage flag value %j', (value) => {
    process.env.CANDIDATE_DIAGNOSTIC_ENABLED = value;
    expect(() => StudentCandidateDiagnosticPage()).toThrow('NEXT_NOT_FOUND');
  });
});

describe('candidate-libre diagnostic dashboard pages — flag ON opens the gate', () => {
  afterEach(() => {
    delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
  });

  it('student page renders DiagnosticPortal once the flag is "true"', () => {
    process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';
    render(StudentCandidateDiagnosticPage());
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockDiagnosticPortal).toHaveBeenCalledTimes(1);
  });

  it('parent page renders ParentDiagnosticPortal once the flag is "true"', async () => {
    process.env.CANDIDATE_DIAGNOSTIC_ENABLED = 'true';
    const params = Promise.resolve({ studentId: 'student-1' });
    const element = await ParentCandidateDiagnosticPage({ params });
    render(element);
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockParentDiagnosticPortal.mock.calls[0]?.[0]).toEqual({ studentId: 'student-1' });
  });
});
