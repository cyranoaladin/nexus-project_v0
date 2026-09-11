import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AriaPracticeAttemptPage from '@/app/dashboard/eleve/aria/practice/[activityId]/page';

const mockPush = jest.fn();
// A stable reference across renders — matching next/navigation's real
// useRouter(), which never returns a fresh object each call. A fresh
// object literal per call would break this page's own useEffect dependency
// array and loop it back into 'loading' forever.
const mockRouter = { push: mockPush };
let sessionValue: { data: unknown; status: string } = {
  data: { user: { id: 'user-1', role: 'ELEVE' } },
  status: 'authenticated',
};
let searchParamsValue = new URLSearchParams({ courseKey: 'eds-maths-premiere' });

jest.mock('next-auth/react', () => ({
  useSession: () => sessionValue,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ activityId: 'activity-1' }),
  useSearchParams: () => searchParamsValue,
}));

const MCQ_ACTIVITY = {
  activityId: 'activity-1',
  courseKey: 'eds-maths-premiere',
  activityType: 'MCQ' as const,
  prompt: {
    questionText: 'Quelle est la dérivée de x² ?',
    options: [{ id: 'a', label: '2x' }, { id: 'b', label: 'x' }],
  },
};
const SHORT_ANSWER_ACTIVITY = {
  activityId: 'activity-1',
  courseKey: 'eds-maths-premiere',
  activityType: 'SHORT_ANSWER' as const,
  prompt: { questionText: 'Formule de la dérivée de x^n ?' },
};

const WELL_FORMED_FEEDBACK = {
  outcome: 'CORRECT' as const,
  summary: 'Bonne réponse, raisonnement correct.',
  strengths: ['Dérivée correcte'],
  improvements: [],
};

function mockFetchSequence(responses: readonly [pattern: string | RegExp, body: unknown, ok?: boolean][]) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    for (const [pattern, body, ok = true] of responses) {
      const matches = typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url);
      if (matches) {
        return { ok, json: async () => body } as Response;
      }
    }
    throw new Error(`unmocked fetch: ${url}`);
  });
}

describe('AriaPracticeAttemptPage', () => {
  beforeEach(() => {
    sessionValue = { data: { user: { id: 'user-1', role: 'ELEVE' } }, status: 'authenticated' };
    searchParamsValue = new URLSearchParams({ courseKey: 'eds-maths-premiere' });
    mockPush.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('redirects to sign-in when unauthenticated', async () => {
    sessionValue = { data: null, status: 'unauthenticated' };
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/signin'));
  });

  it('redirects to sign-in when the session role is not ELEVE', async () => {
    sessionValue = { data: { user: { id: 'user-1', role: 'COACH' } }, status: 'authenticated' };
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/signin'));
  });

  it('shows an error state when courseKey is missing from the URL', async () => {
    searchParamsValue = new URLSearchParams();
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Cours manquant dans le lien.')).toBeInTheDocument());
  });

  it('shows an error state when the activity cannot be found in the course’s real activity list', async () => {
    mockFetchSequence([['/api/aria/practice/activities', { activities: [] }]]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Exercice introuvable.')).toBeInTheDocument());
  });

  it('renders a real MCQ prompt with its real options, submit disabled until one is chosen', async () => {
    mockFetchSequence([['/api/aria/practice/activities', { activities: [MCQ_ACTIVITY] }]]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Quelle est la dérivée de x² ?')).toBeInTheDocument());
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByTestId('aria-practice-submit')).toBeDisabled();

    fireEvent.click(screen.getByText('2x'));
    expect(screen.getByTestId('aria-practice-submit')).not.toBeDisabled();
  });

  it('renders a real SHORT_ANSWER prompt with a textarea, submit disabled until real text is entered', async () => {
    mockFetchSequence([['/api/aria/practice/activities', { activities: [SHORT_ANSWER_ACTIVITY] }]]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Formule de la dérivée de x^n ?')).toBeInTheDocument());
    expect(screen.getByTestId('aria-practice-submit')).toBeDisabled();

    fireEvent.change(screen.getByTestId('aria-practice-answer-text'), { target: { value: 'n*x^(n-1)' } });
    expect(screen.getByTestId('aria-practice-submit')).not.toBeDisabled();
  });

  it('completes the full real submit -> correct flow and shows the real correction result', async () => {
    mockFetchSequence([
      ['/api/aria/practice/activities', { activities: [MCQ_ACTIVITY] }],
      [/\/attempts$/, { attempt: { id: 'attempt-1' } }],
      [/\/attempts\/attempt-1\/submit$/, { attempt: {}, response: {} }],
      [/\/attempts\/attempt-1\/correct$/, { result: { feedback: WELL_FORMED_FEEDBACK }, alreadyCorrected: false }],
    ]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Quelle est la dérivée de x² ?')).toBeInTheDocument());

    fireEvent.click(screen.getByText('2x'));
    fireEvent.click(screen.getByTestId('aria-practice-submit'));

    await waitFor(() => expect(screen.getByTestId('aria-practice-result')).toBeInTheDocument());
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Bonne réponse, raisonnement correct.')).toBeInTheDocument();
    expect(screen.getByText('Dérivée correcte')).toBeInTheDocument();
  });

  it('navigates back to the cockpit via the top link', async () => {
    mockFetchSequence([['/api/aria/practice/activities', { activities: [MCQ_ACTIVITY] }]]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Quelle est la dérivée de x² ?')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Retour au cockpit'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/eleve/aria');
  });

  it('navigates back to the cockpit from the full-page error state', async () => {
    searchParamsValue = new URLSearchParams();
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Cours manquant dans le lien.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Retour au cockpit' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/eleve/aria');
  });

  it('renders an INCORRECT result with real improvements listed, and a working back button from the result view', async () => {
    const incorrectFeedback = {
      outcome: 'INCORRECT' as const,
      summary: 'Ce n’est pas la bonne réponse.',
      strengths: [],
      improvements: ['Revoir la règle de dérivation de x^n'],
    };
    mockFetchSequence([
      ['/api/aria/practice/activities', { activities: [MCQ_ACTIVITY] }],
      [/\/attempts$/, { attempt: { id: 'attempt-1' } }],
      [/\/attempts\/attempt-1\/submit$/, { attempt: {}, response: {} }],
      [/\/attempts\/attempt-1\/correct$/, { result: { feedback: incorrectFeedback }, alreadyCorrected: false }],
    ]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Quelle est la dérivée de x² ?')).toBeInTheDocument());

    fireEvent.click(screen.getByText('2x'));
    fireEvent.click(screen.getByTestId('aria-practice-submit'));

    await waitFor(() => expect(screen.getByTestId('aria-practice-result')).toBeInTheDocument());
    expect(screen.getByText('À revoir')).toBeInTheDocument();
    expect(screen.getByText('Revoir la règle de dérivation de x^n')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('aria-practice-result')).getByRole('button', { name: 'Retour au cockpit' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/eleve/aria');
  });

  it('shows an inline, retryable error when the submit/correct chain fails — the form and the chosen answer stay intact', async () => {
    mockFetchSequence([
      ['/api/aria/practice/activities', { activities: [MCQ_ACTIVITY] }],
      [/\/attempts$/, {}, false],
    ]);
    render(<AriaPracticeAttemptPage />);
    await waitFor(() => expect(screen.getByText('Quelle est la dérivée de x² ?')).toBeInTheDocument());

    fireEvent.click(screen.getByText('2x'));
    fireEvent.click(screen.getByTestId('aria-practice-submit'));

    await waitFor(() => expect(screen.getByText('Impossible de démarrer la tentative.')).toBeInTheDocument());
    // Still on the answering form — the student's choice and the submit
    // button (now retryable) are both still present, not a dead end.
    expect(screen.getByTestId('aria-practice-submit')).not.toBeDisabled();
  });
});
