import { render, screen } from '@testing-library/react';
import PaymentPage from '@/app/dashboard/parent/paiement/page';
import ConfirmationPage from '@/app/dashboard/parent/paiement/confirmation/page';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useSessionMutationSuspended: () => false, useProtectedFetch: () => jest.fn(), useCanonicalSession: () => ({ data: null, status: 'loading' }),
}));

const previous = process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER;
beforeEach(() => { process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER = 'false'; });
afterAll(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER; else process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER = previous; });

test.each([PaymentPage, ConfirmationPage])('disabled payment surface presents no payment or success claim', Page => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Paiements indisponibles' })).toBeInTheDocument();
  expect(screen.queryByText(/demande de paiement a été enregistrée avec succès/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/IBAN|RIB|virement bancaire/i)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Retour à mon espace' })).toHaveAttribute('href', '/dashboard/parent');
});
