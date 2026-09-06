import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import Page from '@/app/dashboard/parent/inscription/page';
jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('@/components/dashboard/parent/ParentRegistrationForm', () => ({ ParentRegistrationForm: ({ data, onSubmit }: { data: { firstName: string }; onSubmit: (input: object) => Promise<void> }) => <div>{data.firstName}<button onClick={() => void onSubmit({})}>Save test dossier</button></div> }));
const session = (id: string) => ({ status: 'authenticated', data: { user: { id, role: 'PARENT' } } });
const response = (name: string) => ({ ok: true, json: async () => ({ firstName: name, children: [] }) });
let originalFetch: typeof fetch;
beforeAll(() => { originalFetch = global.fetch; });
afterAll(() => { global.fetch = originalFetch; });
beforeEach(() => jest.clearAllMocks());
it('does not show the previous family when the parent identity changes without a remount', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response('Famille A')).mockImplementation(() => new Promise(() => {}));
  (useSession as jest.Mock).mockReturnValue(session('parent-a'));
  const view = render(<Page />);
  expect(await screen.findByText('Famille A')).toBeInTheDocument();
  (useSession as jest.Mock).mockReturnValue(session('parent-b'));
  view.rerender(<Page />);
  await waitFor(() => expect(screen.queryByText('Famille A')).not.toBeInTheDocument());
});
it('does not report completion from a late response belonging to a previous parent', async () => {
  let resolveSave!: (value: unknown) => void;
  global.fetch = jest.fn().mockResolvedValueOnce(response('Famille A'))
    .mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }))
    .mockResolvedValue(response('Famille B'));
  (useSession as jest.Mock).mockReturnValue(session('parent-a'));
  const view = render(<Page />);
  await screen.findByText('Famille A');
  fireEvent.click(screen.getByText('Save test dossier'));
  (useSession as jest.Mock).mockReturnValue(session('parent-b'));
  view.rerender(<Page />);
  await act(async () => resolveSave({ ok: true }));
  expect(screen.queryByText('Votre dossier est confirmé')).not.toBeInTheDocument();
});
