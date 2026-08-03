import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

  test('serves the stored report URLs after publication', async () => {
    loadStatus.mockResolvedValue({ attemptId: 'attempt-1', status: 'PUBLISHED', reportStatus: 'PUBLISHED' });
    render(<CanonicalReportViewer attemptId="attempt-1" />);

    const frame = await screen.findByTitle('Bilan Nexus publié');
    expect(frame).toHaveAttribute('src', '/api/bilans/attempts/attempt-1/report?format=html');
    expect(screen.getByRole('link', { name: 'Ouvrir le PDF' })).toHaveAttribute('href', '/api/bilans/attempts/attempt-1/report?format=pdf');
  });

  test('shows a restrained access error when status is denied', async () => {
    loadStatus.mockRejectedValue(new Error('NOT_FOUND'));
    render(<CanonicalReportViewer attemptId="third-party" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce bilan n’est pas accessible avec ce compte.');
  });
});
