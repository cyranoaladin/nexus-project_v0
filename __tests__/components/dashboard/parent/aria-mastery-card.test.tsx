import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AriaMasteryCard } from '@/components/dashboard/parent/AriaMasteryCard';

function mockFetchSequence(responses: readonly [pattern: string | RegExp, body: unknown, ok?: boolean][]) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    for (const [pattern, body, ok = true] of responses) {
      const matches = typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url);
      if (matches) return { ok, json: async () => body } as Response;
    }
    throw new Error(`unmocked fetch: ${url}`);
  });
}

describe('AriaMasteryCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when the family has no ARIA course at all', async () => {
    mockFetchSequence([['/aria/courses', { courses: [] }]]);
    const { container } = render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
    expect(screen.queryByText('Progression ARIA')).not.toBeInTheDocument();
  });

  it('shows a real empty state for a real course with no practice attempt yet', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', { skills: [{ skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'NOT_STARTED', activityId: null }] }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-mastery-card')).toBeInTheDocument());
    expect(screen.getByText(/aucun exercice réalisé pour le moment/)).toBeInTheDocument();
  });

  it('shows real mastery badges for skills the student has actually attempted', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', {
        skills: [
          { skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'DEVELOPING', activityId: 'activity-1' },
          { skillId: 'ALG_SUITE_GEO', skillLabel: 'Suites géométriques', level: 'NOT_STARTED', activityId: null },
        ],
      }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByText('Suites arithmétiques')).toBeInTheDocument());
    expect(screen.getByText('En progrès')).toBeInTheDocument();
    // The untouched skill is real noise, not shown to the parent.
    expect(screen.queryByText('Suites géométriques')).not.toBeInTheDocument();
  });

  it('lets a parent with two real ARIA courses switch between them via tabs', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [
        { courseKey: 'eds-maths-premiere', label: 'Mathématiques' },
        { courseKey: 'eds-nsi-premiere', label: 'NSI' },
      ] }],
      [/courseKey=eds-maths-premiere/, { skills: [{ skillId: 'M1', skillLabel: 'Maths Skill', level: 'MASTERED', activityId: 'a1' }] }],
      [/courseKey=eds-nsi-premiere/, { skills: [{ skillId: 'N1', skillLabel: 'NSI Skill', level: 'PROFICIENT', activityId: 'a2' }] }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByText('Maths Skill')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('aria-mastery-course-tab-eds-nsi-premiere'));
    await waitFor(() => expect(screen.getByText('NSI Skill')).toBeInTheDocument());
    expect(screen.queryByText('Maths Skill')).not.toBeInTheDocument();
  });

  it('never blocks or breaks when the courses fetch fails — the card simply does not render', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { container } = render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('never blocks or breaks when the courses fetch resolves but is not ok — the card simply does not render', async () => {
    mockFetchSequence([['/aria/courses', {}, false]]);
    const { container } = render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('never blocks when the mastery fetch fails after courses loaded — stays on the empty state, not an error', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', {}, false],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-mastery-card')).toBeInTheDocument());
    expect(screen.getByText(/aucun exercice réalisé pour le moment/)).toBeInTheDocument();
  });

  it('shows the real Next Best Action recommendation alongside mastery (P7a)', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', { skills: [] }],
      ['/aria/next-best-action', { action: { courseKey: 'eds-maths-premiere', skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', level: 'NOT_STARTED', activityId: 'activity-1' } }],
      ['/aria/recent-activity', { activity: [] }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-parent-next-best-action')).toBeInTheDocument());
    expect(screen.getByText('Suites arithmétiques')).toBeInTheDocument();
  });

  it('shows real recent activity outcomes alongside mastery (P7a), never the underlying attempt id or chat content', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', { skills: [] }],
      ['/aria/next-best-action', { action: null }],
      ['/aria/recent-activity', { activity: [
        { skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', outcome: 'CORRECT', observedAt: '2026-09-11T10:00:00.000Z' },
        { skillId: 'ALG_SUITE_ARITH', skillLabel: 'Suites arithmétiques', outcome: 'INCORRECT', observedAt: '2026-09-10T10:00:00.000Z' },
      ] }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-parent-recent-activity')).toBeInTheDocument());
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('À revoir')).toBeInTheDocument();
  });

  it('shows neither the recommendation nor the recent activity section when both are real-empty', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/mastery', { skills: [] }],
      ['/aria/next-best-action', { action: null }],
      ['/aria/recent-activity', { activity: [] }],
    ]);
    render(<AriaMasteryCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-mastery-card')).toBeInTheDocument());
    expect(screen.queryByTestId('aria-parent-next-best-action')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aria-parent-recent-activity')).not.toBeInTheDocument();
  });
});
