import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignInForm } from '@/app/auth/signin/SignInForm';
import AccessRequiredPage from '@/app/access-required/page';
import { signIn, getSession } from 'next-auth/react';
import { auth } from '@/auth';
const push = jest.fn();
let callback = '';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(callback) }));
jest.mock('next-auth/react', () => ({ signIn: jest.fn(), getSession: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: { signinAttempt: jest.fn(), signinError: jest.fn(), signinSuccess: jest.fn() } }));
const destinations = [
 ['ADMIN', '/dashboard/admin'], ['ASSISTANTE', '/dashboard/assistante'], ['COACH', '/dashboard/coach'],
 ['PARENT', '/dashboard/parent'], ['ELEVE', '/dashboard/eleve'], ['UNKNOWN', '/auth/signin'], [undefined, '/auth/signin'],
];
beforeEach(() => { jest.clearAllMocks(); callback = ''; });
it.each(destinations)('sign-in sends %s to %s', async (role, path) => {
 (signIn as jest.Mock).mockResolvedValue({ ok: true });
 (getSession as jest.Mock).mockResolvedValue({ user: { role } });
 render(<SignInForm />);
 fireEvent.change(screen.getByLabelText('Téléphone WhatsApp ou email'), { target: { value: 'synthetic@example.test' } });
 fireEvent.change(screen.getByLabelText('Mot de Passe'), { target: { value: 'Synthetic-fixture-access' } });
 fireEvent.submit(screen.getByLabelText('Mot de Passe').closest('form')!);
 await waitFor(() => expect(push).toHaveBeenCalledWith(path));
});
it.each(destinations)('access-required sends %s to %s', async (role, path) => {
 (auth as jest.Mock).mockResolvedValue({ user: { role } });
 // Resolve the server child inside Suspense, then exercise its rendered links.
 const page = AccessRequiredPage({ searchParams: Promise.resolve({ reason: 'denied' }) });
 const content = page.props.children;
 render(await content.type(content.props));
 expect(screen.getByRole('link', { name: /Retour au tableau de bord/i })).toHaveAttribute('href', path);
});
it('does not allow a callback to override the unknown-role safe fallback', async () => {
 callback = 'callbackUrl=%2Fdashboard%2Fparent';
 (signIn as jest.Mock).mockResolvedValue({ ok: true });
 (getSession as jest.Mock).mockResolvedValue({ user: { role: 'UNKNOWN' } });
 render(<SignInForm />);
 fireEvent.change(screen.getByLabelText('Téléphone WhatsApp ou email'), { target: { value: 'synthetic@example.test' } });
 fireEvent.change(screen.getByLabelText('Mot de Passe'), { target: { value: 'Synthetic-fixture-access' } });
 fireEvent.submit(screen.getByLabelText('Mot de Passe').closest('form')!);
 await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/signin'));
});
