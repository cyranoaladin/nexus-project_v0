import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { SignInForm } from '@/app/auth/signin/SignInForm';
import { getSession, signIn } from 'next-auth/react';
import { randomBytes } from 'node:crypto';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next-auth/react', () => ({ signIn: jest.fn(), getSession: jest.fn() }));
jest.mock('@/lib/analytics', () => ({
  track: { signinAttempt: jest.fn(), signinError: jest.fn(), signinSuccess: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test('server-rendered controls cannot accept input before their React handlers are ready', () => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<SignInForm />);

  for (const selector of ['#email', '#password', '[data-testid="btn-toggle-password"]', '[data-testid="btn-signin"]']) {
    expect(container.querySelector(selector)).toBeDisabled();
  }
});

test('hydration enables the form and retains both values through submission', async () => {
  const fixturePassword = randomBytes(24).toString('base64url');
  const container = document.createElement('div');
  container.innerHTML = renderToString(<SignInForm />);
  document.body.appendChild(container);
  (signIn as jest.Mock).mockResolvedValue({ ok: true });
  (getSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } });

  render(<SignInForm />, { container, hydrate: true });
  const identifier = screen.getByLabelText('Téléphone WhatsApp ou email');
  const password = screen.getByLabelText('Mot de Passe');
  expect(identifier).toBeEnabled();
  expect(password).toBeEnabled();
  fireEvent.change(identifier, { target: { value: 'hydration@example.test' } });
  fireEvent.change(password, { target: { value: fixturePassword } });
  expect(identifier).toHaveValue('hydration@example.test');
  fireEvent.submit(identifier.closest('form')!);

  await waitFor(() => expect(signIn).toHaveBeenCalledWith('credentials', {
    identifier: 'hydration@example.test', password: fixturePassword, redirect: false,
  }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/parent'));
});
