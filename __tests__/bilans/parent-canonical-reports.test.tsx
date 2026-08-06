import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ParentCanonicalReports } from '@/components/bilans/ParentCanonicalReports';
import { loadParentCanonicalReports } from '@/lib/bilans/passation/parent-report-protocol';

jest.mock('@/lib/bilans/passation/parent-report-protocol', () => ({
  loadParentCanonicalReports: jest.fn(),
  parentCanonicalReportUrl: (studentId: string, attemptId: string, format: string) => (
    `/api/parent/children/${studentId}/bilans/${attemptId}/report?format=${format}`
  ),
}));

const loadReports = loadParentCanonicalReports as jest.MockedFunction<typeof loadParentCanonicalReports>;

describe('P0-C Parent Canonical reports surface', () => {
  beforeEach(() => jest.clearAllMocks());

  test('announces loading and then renders an accessible empty state', async () => {
    loadReports.mockResolvedValue({ studentId: 'student-a1', bilans: [] });
    render(<ParentCanonicalReports studentId="student-a1" />);

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des bilans');
    expect(await screen.findByText('Aucun bilan de positionnement pour cet enfant.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Actualiser les bilans' })).toBeVisible();
  });

  test('renders real lifecycle states without exposing unpublished content', async () => {
    loadReports.mockResolvedValue({
      studentId: 'student-a1',
      bilans: [
        { attemptId: 'a1', level: 'SECONDE', subject: 'MATHEMATIQUES', title: 'Mathématiques · Seconde', status: 'DRAFT', updatedAt: '2026-08-04T08:00:00.000Z', reportAvailable: false },
        { attemptId: 'a2', level: 'SECONDE', subject: 'FRANCAIS', title: 'Français · Seconde', status: 'SUBMITTED', updatedAt: '2026-08-04T08:01:00.000Z', reportAvailable: false },
        { attemptId: 'a3', level: 'SECONDE', subject: 'MATHEMATIQUES', title: 'Mathématiques · Seconde', status: 'REPORT_PENDING_REVIEW', updatedAt: '2026-08-04T08:02:00.000Z', reportAvailable: false },
      ],
    });
    render(<ParentCanonicalReports studentId="student-a1" />);

    expect(await screen.findByText('Bilan commencé')).toBeVisible();
    expect(screen.getByText('Réponses reçues')).toBeVisible();
    expect(screen.getByText('Relecture pédagogique en cours')).toBeVisible();
    expect(screen.queryByTitle(/Bilan Parents publié/)).not.toBeInTheDocument();
  });

  test('opens only the published Parents HTML and PDF endpoints', async () => {
    loadReports.mockResolvedValue({
      studentId: 'student-a1',
      bilans: [{
        attemptId: 'attempt-a1', level: 'SECONDE', subject: 'MATHEMATIQUES',
        title: 'Mathématiques · Seconde', status: 'PUBLISHED',
        updatedAt: '2026-08-04T08:00:00.000Z', reportAvailable: true,
      }],
    });
    render(<ParentCanonicalReports studentId="student-a1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Lire le bilan Mathématiques · Seconde' }));
    expect(screen.getByTitle('Bilan Parents publié · Mathématiques · Seconde')).toHaveAttribute(
      'src',
      '/api/parent/children/student-a1/bilans/attempt-a1/report?format=html',
    );
    expect(screen.getByRole('link', { name: 'Télécharger le PDF Mathématiques · Seconde' })).toHaveAttribute(
      'href',
      '/api/parent/children/student-a1/bilans/attempt-a1/report?format=pdf',
    );
  });

  test('announces a fail-closed error', async () => {
    loadReports.mockRejectedValue(new Error('NOT_FOUND'));
    render(<ParentCanonicalReports studentId="student-b1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les bilans de cet enfant ne sont pas accessibles avec ce compte.',
    );
    await waitFor(() => expect(loadReports).toHaveBeenCalledWith('student-b1'));
  });

  test('re-fetches when refreshSignal changes without the studentId changing (post-consent refresh)', async () => {
    loadReports.mockResolvedValue({ studentId: 'student-a1', bilans: [] });
    const { rerender } = render(<ParentCanonicalReports studentId="student-a1" refreshSignal={0} />);

    await waitFor(() => expect(loadReports).toHaveBeenCalledTimes(1));

    // Simulate the parent having just verified consent: the list request that ran
    // while consent was PENDING must be re-issued once consent becomes VERIFIED,
    // even though studentId is unchanged.
    rerender(<ParentCanonicalReports studentId="student-a1" refreshSignal={1} />);

    await waitFor(() => expect(loadReports).toHaveBeenCalledTimes(2));
  });
});
