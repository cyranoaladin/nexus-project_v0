import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import Page from '@/app/dashboard/parent/inscription/page';
import { SessionRecoveryProvider } from '@/components/auth/SessionRecoveryProvider';
jest.unmock('@/components/auth/SessionRecoveryProvider');
jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, usePathname: () => '/dashboard/parent/inscription', useSearchParams: () => mockSearch }));
const mockSearch = new URLSearchParams();
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('@/components/dashboard/parent/ParentRegistrationForm', () => ({ ParentRegistrationForm: ({ data, onSubmit }: { data: { firstName: string }; onSubmit: (input: object) => Promise<void> }) => <div>{data.firstName}<button onClick={() => void onSubmit({}).catch(() => {})}>Save test dossier</button></div> }));
const session = (id: string) => ({ status: 'authenticated', data: { user: { id, role: 'PARENT' }, expires: '2099-01-01T00:00:00Z' } });
const response = (name: string) => ({ ok: true, json: async () => ({ firstName: name, children: [] }) });
let originalFetch: typeof fetch;
beforeAll(() => { originalFetch = global.fetch; });
afterAll(() => { global.fetch = originalFetch; });
beforeEach(() => jest.clearAllMocks());
it('does not show the previous family when the parent identity changes without a remount', async () => {
  let current = session('parent-a');
  global.fetch = jest.fn(async input => input === '/api/auth/session'
    ? { ok: true, json: async () => current.data } as Response
    : current.data.user.id === 'parent-a' ? response('Famille A') as Response : new Promise<Response>(() => {}));
  (useSession as jest.Mock).mockReturnValue(session('parent-a'));
  const view = render(<SessionRecoveryProvider><Page /></SessionRecoveryProvider>);
  expect(await screen.findByText('Famille A')).toBeInTheDocument();
  (useSession as jest.Mock).mockReturnValue(session('parent-b'));
  current = session('parent-b');
  view.rerender(<SessionRecoveryProvider><Page /></SessionRecoveryProvider>);
  await waitFor(() => expect(screen.queryByText('Famille A')).not.toBeInTheDocument());
});
it('does not report completion from a late response belonging to a previous parent', async () => {
  let resolveSave!: (value: Response) => void;
  let current = session('parent-a');
  global.fetch = jest.fn(async (input, init) => {
    if (input === '/api/auth/session') return { ok: true, json: async () => current.data } as Response;
    if (init?.method === 'PUT' || init?.method === 'POST') return new Promise<Response>(resolve => { resolveSave = resolve; });
    return response(current.data.user.id === 'parent-a' ? 'Famille A' : 'Famille B') as Response;
  });
  (useSession as jest.Mock).mockReturnValue(session('parent-a'));
  const view = render(<SessionRecoveryProvider><Page /></SessionRecoveryProvider>);
  await screen.findByText('Famille A');
  fireEvent.click(screen.getByText('Save test dossier'));
  (useSession as jest.Mock).mockReturnValue(session('parent-b'));
  current = session('parent-b');
  view.rerender(<SessionRecoveryProvider><Page /></SessionRecoveryProvider>);
  await act(async () => resolveSave({ ok: true } as Response));
  expect(screen.queryByText('Votre dossier est confirmé')).not.toBeInTheDocument();
});
