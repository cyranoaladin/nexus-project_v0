import { render, screen, waitFor } from '@testing-library/react';
import { AriaWorkshopsCard } from '@/components/dashboard/parent/AriaWorkshopsCard';

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

describe('AriaWorkshopsCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when the family has no ARIA course at all', async () => {
    mockFetchSequence([['/aria/courses', { courses: [] }]]);
    const { container } = render(<AriaWorkshopsCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('renders nothing when the child has no real workshop attendance yet', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/workshops', { workshops: [] }],
    ]);
    const { container } = render(<AriaWorkshopsCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('shows a real workshop with the real attendance status', async () => {
    mockFetchSequence([
      ['/aria/courses', { courses: [{ courseKey: 'eds-maths-premiere', label: 'Mathématiques' }] }],
      ['/aria/workshops', {
        workshops: [{
          id: 'w1', title: 'Atelier révisions', scheduledDate: '2026-10-01T00:00:00.000Z',
          startTime: '14:00', endTime: '15:00', location: null, childAttendanceStatus: 'ATTENDED',
        }],
      }],
    ]);
    render(<AriaWorkshopsCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-workshops-card')).toBeInTheDocument());
    expect(screen.getByText(/Atelier révisions/)).toBeInTheDocument();
    expect(screen.getByText('Présent·e')).toBeInTheDocument();
  });

  it('never blocks or breaks when the courses fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { container } = render(<AriaWorkshopsCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });
});
