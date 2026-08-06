import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CanonicalAssessmentStart } from '@/components/bilans/CanonicalAssessmentStart';
import { CanonicalReportViewer } from '@/components/bilans/CanonicalReportViewer';
import { createCanonicalAttempt, loadCanonicalReportStatus } from '@/lib/bilans/passation/pilot-protocol';

const replace = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
jest.mock('@/lib/bilans/passation/pilot-protocol', () => ({
  createCanonicalAttempt: jest.fn(),
  loadCanonicalReportStatus: jest.fn(),
  canonicalReportUrl: (id: string, format: string) => `/api/bilans/attempts/${id}/report?format=${format}`,
}));

const createAttempt = createCanonicalAttempt as jest.MockedFunction<typeof createCanonicalAttempt>;
const loadStatus = loadCanonicalReportStatus as jest.MockedFunction<typeof loadCanonicalReportStatus>;

describe('A123 Canonical pilot browser surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reuses one idempotency key when a student retries creation', async () => {
    createAttempt
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ attemptId: 'attempt-1', status: 'DRAFT', startedAt: '2026-08-12T08:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' });
    render(<CanonicalAssessmentStart packs={[{ slug: 'entree-premiere-maths-v1', label: 'Entrée en Première · Mathématiques' }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Entrée en Première · Mathématiques' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Entrée en Première · Mathématiques' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/bilan-gratuit/assessment?attemptId=attempt-1'));

    expect(createAttempt).toHaveBeenCalledTimes(2);
    expect(createAttempt.mock.calls[0][1]).toBe(createAttempt.mock.calls[1][1]);
  });

  test('uses a distinct idempotency key per pack so selecting another pack cannot replay the first', async () => {
    createAttempt
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ attemptId: 'attempt-2', status: 'DRAFT', startedAt: '2026-08-12T08:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' });
    render(
      <CanonicalAssessmentStart
        packs={[
          { slug: 'entree-premiere-maths-v1', label: 'Entrée en Première · Mathématiques' },
          { slug: 'entree-premiere-nsi-v1', label: 'Entrée en Première · NSI' },
        ]}
      />
    );

    // First pack fails ambiguously (network error) — key is created and retained for that pack.
    fireEvent.click(screen.getByRole('button', { name: 'Entrée en Première · Mathématiques' }));
    await screen.findByRole('alert');

    // The student picks a DIFFERENT pack instead of retrying the same one.
    fireEvent.click(screen.getByRole('button', { name: 'Entrée en Première · NSI' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/bilan-gratuit/assessment?attemptId=attempt-2'));

    expect(createAttempt).toHaveBeenCalledTimes(2);
    expect(createAttempt.mock.calls[0][0]).toBe('entree-premiere-maths-v1');
    expect(createAttempt.mock.calls[1][0]).toBe('entree-premiere-nsi-v1');
    // The two packs must never share an idempotency key, or the API would replay
    // the first pack's stored attempt for the second pack's request.
    expect(createAttempt.mock.calls[0][1]).not.toBe(createAttempt.mock.calls[1][1]);
  });

  test('serves the stored report URLs after publication', async () => {
    loadStatus.mockResolvedValue({ attemptId: 'attempt-1', status: 'PUBLISHED', reportStatus: 'PUBLISHED' });
    render(<CanonicalReportViewer attemptId="attempt-1" />);

    const frame = await screen.findByTitle('Bilan Nexus publié');
    expect(frame).toHaveAttribute('src', '/api/bilans/attempts/attempt-1/report?format=html');
    expect(screen.getByRole('link', { name: 'Ouvrir le PDF' })).toHaveAttribute('href', '/api/bilans/attempts/attempt-1/report?format=pdf');
  });

  test('shows a restrained access error when status is denied', async () => {
    loadStatus.mockRejectedValue(Object.assign(new Error('NOT_FOUND'), { status: 404 }));
    render(<CanonicalReportViewer attemptId="third-party" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce bilan n’est pas accessible avec ce compte.');
  });

  test('shows a restrained access error when the session is unauthenticated (401)', async () => {
    loadStatus.mockRejectedValue(Object.assign(new Error('AUTHENTICATION_REQUIRED'), { status: 401 }));
    render(<CanonicalReportViewer attemptId="attempt-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce bilan n’est pas accessible avec ce compte.');
  });

  test('resumes polling after a transient network/server error instead of permanently denying access', async () => {
    jest.useFakeTimers();
    try {
      loadStatus
        .mockRejectedValueOnce(Object.assign(new Error('CANONICAL_REPORT_STATUS_FAILED'), { status: 500 }))
        .mockResolvedValueOnce({ attemptId: 'attempt-1', status: 'SUBMITTED', reportStatus: null });

      render(<CanonicalReportViewer attemptId="attempt-1" />);

      await waitFor(() => expect(loadStatus).toHaveBeenCalledTimes(1));
      // A transient failure must NOT be treated as an access denial.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => expect(loadStatus).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('resumes polling after a plain network error without an http status (e.g. fetch TypeError)', async () => {
    jest.useFakeTimers();
    try {
      loadStatus
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ attemptId: 'attempt-1', status: 'SUBMITTED', reportStatus: null });

      render(<CanonicalReportViewer attemptId="attempt-1" />);

      await waitFor(() => expect(loadStatus).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000);
      });

      await waitFor(() => expect(loadStatus).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
