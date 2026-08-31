import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: 'ASSISTANTE' } }, status: 'authenticated' }),
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import AssistantePlanningPage from '@/app/dashboard/assistante/stages/planning/page';

describe('planning stages student search transport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/assistante/planning?')) {
        return Promise.resolve(new Response(JSON.stringify({ events: [] }), { status: 200 }));
      }
      if (url === '/api/assistante/stages/planning/students/search' && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({
          items: [{ userId: 'student-user-1', displayName: 'Yasmine Ben Salah', email: 'yasmine@example.test' }],
        }), { status: 200 }));
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;
  });

  test('searches and selects a student without putting the query in a URL', async () => {
    const user = userEvent.setup();
    render(<AssistantePlanningPage />);
    await user.click(await screen.findByRole('button', { name: /nouvelle séance/i }));
    await user.type(screen.getByPlaceholderText(/rechercher.*nom\/email/i), 'yasmine');

    const option = await screen.findByRole('button', { name: /yasmine ben salah/i });
    const searchCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/assistante/stages/planning/students/search');
    expect(searchCall).toBeDefined();
    expect(searchCall[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'yasmine', page: 1, limit: 10 }),
    });
    expect((global.fetch as jest.Mock).mock.calls.every(([url]) => !String(url).includes('yasmine'))).toBe(true);

    await user.click(option);
    await waitFor(() => expect(screen.getByText('yasmine@example.test')).toBeInTheDocument());
  });
});
