import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnexionForm } from '@/app/espace/connexion/ConnexionForm';

const signIn = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }) }));
jest.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

beforeEach(() => signIn.mockReset().mockResolvedValue({ error: 'CredentialsSignin' }));

it('distinguishes tolerant student codes from exact teacher passwords without capitalizing either', () => {
  render(<ConnexionForm />);
  const input = screen.getByLabelText('Code personnel ou mot de passe');
  expect(input).toHaveAttribute('autocapitalize', 'none');
  expect(input).toHaveAttribute('autocomplete', 'current-password');
  expect(screen.getByText(/Élèves :.*majuscules.*minuscules.*tirets/i)).toBeVisible();
  expect(screen.getByText(/Enseignants :.*mot de passe exact.*majuscules.*minuscules.*tirets/i)).toBeVisible();
  expect(screen.getByText(/Enseignants :.*administrateur/i)).toBeVisible();
});

it('labels the reveal control for both credential kinds and retains its current value', () => {
  render(<ConnexionForm />);
  const input = screen.getByTestId('input-secret');
  fireEvent.change(input, { target: { value: 'Fictif-MiXeD-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Afficher le code ou le mot de passe' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('Fictif-MiXeD-42');
  fireEvent.click(screen.getByRole('button', { name: 'Masquer le code ou le mot de passe' }));
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('Fictif-MiXeD-42');
});

it('submits a fictitious secret unchanged and reports a generic failure for either credential kind', async () => {
  render(<ConnexionForm />);
  const fictitiousSecret = ' Fictif-aB-42 ! ';
  fireEvent.change(screen.getByTestId('input-username'), { target: { value: 'prof.fictif' } });
  fireEvent.change(screen.getByTestId('input-secret'), { target: { value: fictitiousSecret } });
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledWith('espace', { username: 'prof.fictif', secret: fictitiousSecret, redirect: false }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Identifiant, code personnel ou mot de passe incorrect.');
  expect(alert).toHaveTextContent('Après plusieurs essais');
  expect(alert).not.toHaveTextContent(/compte inconnu|compte existant|enseignant|élève/i);
});
