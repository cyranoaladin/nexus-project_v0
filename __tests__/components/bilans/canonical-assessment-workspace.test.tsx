import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CanonicalAssessmentWorkspace } from '@/components/bilans/CanonicalAssessmentWorkspace';

function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => body,
  }) as Promise<Response>;
}

describe('CanonicalAssessmentWorkspace', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/assignments')) {
        return response({
          assignments: [{
            id: 'assignment-1',
            definitionId: 'definition-1',
            opensAt: '2026-07-30T08:00:00.000Z',
            dueAt: null,
            status: 'AVAILABLE',
          }],
        });
      }
      if (url.endsWith('/assignments/assignment-1/definition')) {
        return response({
          definition: {
            id: 'definition-1',
            title: 'Test canonique',
            framing: 'Travail individuel.',
            targetDurationMinutes: 20,
            rationale: 'CORRIGE_INTERNE_SECRET',
            items: [{
              id: 'qcm-1',
              prompt: 'Choisissez une réponse.',
              responseMode: 'AUTOMATIC_QCM',
              options: [
                { index: 0, text: 'Option A', correct: false },
                { index: 1, text: 'Option B', correct: true },
              ],
            }],
          },
        });
      }
      if (
        url.endsWith('/assignments/assignment-1/attempt')
        && init?.method === 'POST'
      ) {
        return response({ attempt: { id: 'attempt-1', status: 'IN_PROGRESS' } });
      }
      if (url.endsWith('/attempts/attempt-1/status')) {
        return response({
          attempt: {
            id: 'attempt-1',
            status: 'IN_PROGRESS',
            responses: [],
          },
        });
      }
      if (
        url.endsWith('/attempts/attempt-1/responses/qcm-1')
        && init?.method === 'PUT'
      ) {
        return response({ response: { itemId: 'qcm-1', version: 1 } });
      }
      if (
        url.endsWith('/attempts/attempt-1/submit')
        && init?.method === 'POST'
      ) {
        return response({
          attempt: {
            id: 'attempt-1',
            status: 'PENDING_MANUAL_REVIEW',
            pendingManualReviewCount: 1,
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as jest.MockedFunction<typeof fetch>;
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs autosave and sealed submission without rendering answer keys', async () => {
    const user = userEvent.setup();
    render(<CanonicalAssessmentWorkspace />);

    await user.click(await screen.findByRole('button', {
      name: 'Commencer ou reprendre',
    }));
    const option = await screen.findByRole('radio', { name: 'Option B' });
    expect(screen.queryByText('CORRIGE_INTERNE_SECRET')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('"correct"');

    await user.click(option);
    await screen.findByText('Sauvegarde effectuée.');
    await user.click(screen.getByRole('button', {
      name: 'Soumettre définitivement',
    }));

    expect(await screen.findByText(
      'Soumission reçue. Une correction humaine est en cours.',
    )).toBeInTheDocument();
    await waitFor(() => expect(option).toBeDisabled());
    expect(
      screen.queryByRole('button', { name: 'Soumettre définitivement' }),
    ).not.toBeInTheDocument();
  });
});
