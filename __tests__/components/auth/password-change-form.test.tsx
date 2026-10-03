import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';
const mockRouter = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
const mockFetch = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useProtectedFetch: () => mockFetch,
  useCanonicalSignOut: () => mockSignOut,
}));
beforeEach(() => { mockFetch.mockReset(); mockSignOut.mockReset(); mockRouter.replace.mockReset(); mockSignOut.mockResolvedValue(undefined); });
function fill() {
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'change_me_current' } });
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'change_me_new' } });
  fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'change_me_new' } });
}
describe('PasswordChangeForm', () => {
  test('uses the server-selected native V1 endpoint for a V1 account', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { sessionsRevoked: true } }) });
    render(<PasswordChangeForm endpoint="/api/auth/password-change" />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/password-change', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ currentPassword: 'change_me_current', newPassword: 'change_me_new' }),
    }));
  });
  test('submits only passwords and signs out after confirmed success', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { sessionsRevoked: true } }) });
    render(<PasswordChangeForm />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ redirect: false, callbackUrl: '/auth/signin' }));
    expect(mockFetch).toHaveBeenCalledWith('/api/v2/auth/password-change', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ currentPassword: 'change_me_current', newPassword: 'change_me_new' }),
    }));
  });
  test('refuses mismatched confirmation and overlong UTF-8 input locally', async () => {
    render(<PasswordChangeForm />); fill();
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'change_me_other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ne correspondent pas');
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'é'.repeat(37) } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'é'.repeat(37) } });
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('72 octets');
    expect(mockFetch).not.toHaveBeenCalled();
  });
  test('prevents concurrent submissions and keeps the form usable after refusal', async () => {
    let resolve: (value: unknown) => void = () => { throw new Error('Request not started.'); };
    mockFetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<PasswordChangeForm />); fill();
    const button = screen.getByRole('button', { name: 'Changer mon mot de passe' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ ok: false, status: 403, json: async () => ({ ok: false }) }); });
    expect(screen.getByRole('alert')).toHaveTextContent('mot de passe actuel');
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Changer mon mot de passe' })).toBeEnabled();
  });
  test('distinguishes a confirmed password change from an unconfirmed local logout', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { sessionsRevoked: true } }) });
    mockSignOut.mockRejectedValue(new Error('SYNTHETIC_LOGOUT_UNAVAILABLE'));
    render(<PasswordChangeForm />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('fermeture locale'));
    expect(screen.getByRole('status')).toHaveTextContent('anciennes sessions sont révoquées');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Se reconnecter' })).toHaveAttribute('href', '/auth/signin');
  });
  test('reports network failure without claiming success or signing out', async () => {
    mockFetch.mockRejectedValue(new Error('SYNTHETIC_NETWORK_FAILURE'));
    render(<PasswordChangeForm />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Changer mon mot de passe' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connexion interrompue'));
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
