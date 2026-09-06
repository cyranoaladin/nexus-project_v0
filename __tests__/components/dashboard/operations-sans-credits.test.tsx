import { render, screen } from '@testing-library/react';
import { OperationsCard } from '@/components/dashboard/OperationsCard';
it('counts payments and admissions without credit requests', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ stats: { pendingSubscriptionRequests: 2, pendingPayments: 3, pendingCreditRequests: 50, totalStudents: 10 }, todaySessions: [] }) } as Response);
  render(<OperationsCard />);
  await screen.findByText('Demandes en attente');
  for (const value of ['5', '3', '0', '10']) expect(screen.getByText(value)).toBeInTheDocument();
  expect(screen.queryByText('50')).not.toBeInTheDocument();
  expect(screen.queryByText(/Crédits en attente/i)).not.toBeInTheDocument();
});

afterEach(() => jest.restoreAllMocks());
