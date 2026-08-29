import { render, screen, waitFor } from '@testing-library/react';

import { CanonicalAssessmentTeamWorkspace } from '@/components/bilans/CanonicalAssessmentTeamWorkspace';

function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => body,
  }) as Promise<Response>;
}

describe('CanonicalAssessmentTeamWorkspace', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/manual-reviews')) return response({ tasks: [] });
      if (url.endsWith('/requests')) {
        return response({
          requests: [{
            id: 'request-1',
            studentId: 'student-1',
            subject: 'MATHEMATIQUES',
            gradeLevel: 'TERMINALE',
            schoolYear: '2026-2027',
            status: 'READY_FOR_ASSESSMENT',
            lastActivityAt: '2026-07-30T08:00:00.000Z',
          }],
        });
      }
      if (url.endsWith('/catalog')) {
        return response({
          definitions: [{
            definitionId: 'maths-terminale',
            moduleId: 'module-maths-terminale',
            subject: 'MATHEMATIQUES',
            level: 'TERMINALE',
            title: 'Mathématiques Terminale',
            publicationStatus: 'HUMAN_VALIDATION_REQUIRED',
            version: 'v1',
            sha256: `sha256:${'a'.repeat(64)}`,
            sessionCount: 5,
            itemCount: 24,
            manualResponseCount: 2,
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows team requests and hash-bound validation state without enabling assignment', async () => {
    render(<CanonicalAssessmentTeamWorkspace role="ADMIN" />);

    expect(await screen.findByText('Demande request-1')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques Terminale')).toBeInTheDocument();
    expect(
      screen.getAllByText(/HUMAN_VALIDATION_REQUIRED/),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Créer l’affectation' }),
    ).toBeDisabled();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bilan-gratuit/v1/team/catalog',
        expect.any(Object),
      );
    });
  });
});
