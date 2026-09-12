import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AriaWorkshopsSection } from '@/components/aria/cockpit/AriaWorkshopsSection';

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

describe('AriaWorkshopsSection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when there are no real workshops for this course', async () => {
    mockFetchSequence([['/api/aria/workshops', { workshops: [] }]]);
    const { container } = render(<AriaWorkshopsSection courseKey="eds-maths-premiere" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('renders nothing when the fetch fails — never blocks the workspace', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { container } = render(<AriaWorkshopsSection courseKey="eds-maths-premiere" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('shows a real workshop with a register CTA when the student has no attendance status yet', async () => {
    mockFetchSequence([
      ['/api/aria/workshops', {
        workshops: [{
          id: 'w1', title: 'Atelier révisions', scheduledDate: '2026-10-01T00:00:00.000Z',
          startTime: '14:00', endTime: '15:00', location: 'En ligne', coachName: 'Hélios', myAttendanceStatus: null,
        }],
      }],
    ]);
    render(<AriaWorkshopsSection courseKey="eds-maths-premiere" />);
    await waitFor(() => expect(screen.getByText('Atelier révisions')).toBeInTheDocument());
    expect(screen.getByTestId('aria-workshop-register-w1')).toBeInTheDocument();
  });

  it('shows the real attendance status instead of a register CTA once the student is already registered', async () => {
    mockFetchSequence([
      ['/api/aria/workshops', {
        workshops: [{
          id: 'w1', title: 'Atelier révisions', scheduledDate: '2026-10-01T00:00:00.000Z',
          startTime: '14:00', endTime: '15:00', location: null, coachName: null, myAttendanceStatus: 'REGISTERED',
        }],
      }],
    ]);
    render(<AriaWorkshopsSection courseKey="eds-maths-premiere" />);
    await waitFor(() => expect(screen.getByText('Inscrit·e')).toBeInTheDocument());
    expect(screen.queryByTestId('aria-workshop-register-w1')).not.toBeInTheDocument();
  });

  it('registers via the real endpoint and reloads the real list on click', async () => {
    let registered = false;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/register')) {
        registered = true;
        return { ok: true, json: async () => ({ status: 'REGISTERED' }) } as Response;
      }
      if (url.includes('/api/aria/workshops')) {
        return {
          ok: true,
          json: async () => ({
            workshops: [{
              id: 'w1', title: 'Atelier révisions', scheduledDate: '2026-10-01T00:00:00.000Z',
              startTime: '14:00', endTime: '15:00', location: null, coachName: null,
              myAttendanceStatus: registered ? 'REGISTERED' : null,
            }],
          }),
        } as Response;
      }
      void init;
      throw new Error(`unmocked fetch: ${url}`);
    });
    render(<AriaWorkshopsSection courseKey="eds-maths-premiere" />);
    await waitFor(() => expect(screen.getByTestId('aria-workshop-register-w1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('aria-workshop-register-w1'));
    await waitFor(() => expect(screen.getByText('Inscrit·e')).toBeInTheDocument());
  });
});
