import { render, screen } from '@testing-library/react';
import PaymentPage from '@/app/dashboard/assistante/paiements/page';
const mockFetch = jest.fn();
const mockSession = jest.fn();
const mockRouter = { push: jest.fn() };
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useProtectedFetch: () => mockFetch, useCanonicalSession: () => mockSession(),
  useSessionMutationSuspended: () => false,
}));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ payments: [{
    id: 'synthetic-payment', user: { id: 'synthetic-payer', firstName: 'Synthetic', lastName: 'Fixture', email: 'synthetic@fixture.test' },
    amount: 100, description: 'Synthetic pending payment', method: 'BANK_TRANSFER', type: 'SPECIAL_PACK',
    createdAt: '2026-10-04T10:00:00Z', metadata: null,
  }] }) });
});
it('read-only assistant sees the payment but no validation or rejection controls', async () => {
  mockSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'synthetic-staff', role: 'ASSISTANTE' } } });
  render(<PaymentPage />);
  expect(await screen.findByText('Synthetic pending payment')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Valider le Paiement' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument();
  expect(screen.getByText(/Consultation uniquement/)).toBeInTheDocument();
});
it('staff with canonical PAYMENT UPDATE permission retains mutation controls', async () => {
  mockSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'synthetic-admin', role: 'ADMIN' } } });
  render(<PaymentPage />);
  expect(await screen.findByRole('button', { name: 'Valider le Paiement' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument();
});

it('ADMIN cannot approve a payment while bank transfers are disabled but can still reject it', async () => {
  const previous = process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER;
  process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER = 'false';
  try {
    mockSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'synthetic-admin', role: 'ADMIN' } } });
    render(<PaymentPage />);
    expect(await screen.findByText('Synthetic pending payment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider le Paiement' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER;
    else process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER = previous;
  }
});
