import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CanonicalAssessmentRunner } from '@/components/bilans/CanonicalAssessmentRunner';

const baseDto = {
  attemptId: 'attempt-1',
  pack: { slug: 'fixture-pack', version: 1, title: 'Mathématiques · Terminale' },
  status: 'DRAFT' as const,
  revision: 3,
  expiresAt: '2026-08-17T10:00:00.000Z',
  items: [
    {
      id: 'item-1',
      prompt: 'Première question ?',
      options: [
        { id: 'A', label: 'Option A' },
        { id: 'B', label: 'Option B' },
      ],
      savedAnswer: { optionId: null, confidence: null },
      isCorrect: '__CORRECT__',
      distractorRationale: '__RATIONALE__',
    },
    {
      id: 'item-2',
      prompt: 'Deuxième question ?',
      options: [
        { id: 'A', label: 'Option C' },
        { id: 'B', label: 'Option D' },
      ],
      savedAnswer: { optionId: 'B', confidence: 4 },
    },
  ],
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('CanonicalAssessmentRunner', () => {
  afterEach(() => jest.restoreAllMocks());

  test('uses only the sanitized server order and requires confidence before autosave', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(baseDto))
      .mockResolvedValueOnce(response({ revision: 4, savedItemIds: ['item-1'] }));
    const user = userEvent.setup();

    const { container } = render(<CanonicalAssessmentRunner attemptId="attempt-1" />);
    expect(await screen.findByRole('heading', { name: 'Première question ?' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual(['Option A', 'Option B']);
    expect(container).not.toHaveTextContent('__CORRECT__');
    expect(container).not.toHaveTextContent('__RATIONALE__');

    await user.click(screen.getByRole('radio', { name: 'Option B' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /confiance 3/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const patch = fetchMock.mock.calls[1];
    expect(patch[0]).toBe('/api/bilans/attempts/attempt-1/answers');
    expect(patch[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({
      revision: 3,
      answers: [{ itemId: 'item-1', optionId: 'B', confidence: 3 }],
    });
  });

  test('preserves the unsaved choice on a revision conflict and retries from the server revision', async () => {
    const reloaded = {
      ...baseDto,
      revision: 4,
      items: baseDto.items.map((item) => ({ ...item, savedAnswer: { optionId: null, confidence: null } })),
    };
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(baseDto))
      .mockResolvedValueOnce(response({ error: { code: 'REVISION_CONFLICT', details: { serverRevision: 4 } } }, 409))
      .mockResolvedValueOnce(response(reloaded))
      .mockResolvedValueOnce(response({ revision: 5, savedItemIds: ['item-1'] }));
    const user = userEvent.setup();

    render(<CanonicalAssessmentRunner attemptId="attempt-1" />);
    await screen.findByRole('heading', { name: 'Première question ?' });
    await user.click(screen.getByRole('radio', { name: 'Option B' }));
    await user.click(screen.getByRole('button', { name: /confiance 2/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/conflit/i);
    expect(screen.getByRole('radio', { name: 'Option B' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /réessayer/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(JSON.parse(String((fetchMock.mock.calls[3][1] as RequestInit).body))).toMatchObject({ revision: 4 });
  });

  test('resumes saved answers and requires explicit irreversible submission confirmation', async () => {
    const completeDto = {
      ...baseDto,
      items: baseDto.items.map((item) => ({ ...item, savedAnswer: { optionId: 'B', confidence: 4 } })),
    };
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(completeDto))
      .mockResolvedValueOnce(response({ attemptId: 'attempt-1', status: 'SUBMITTED', revision: 4 }));
    const user = userEvent.setup();

    render(<CanonicalAssessmentRunner attemptId="attempt-1" />);
    await screen.findByRole('heading', { name: 'Première question ?' });
    expect(screen.getByRole('radio', { name: 'Option B' })).toBeChecked();
    expect(screen.getByText(/expire le/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /terminer le questionnaire/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/irréversible/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirmer l’envoi/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/questionnaire envoyé/i)).toBeInTheDocument();
  });
});
