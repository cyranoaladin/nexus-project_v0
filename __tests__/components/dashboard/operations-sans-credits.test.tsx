import { render, screen, within } from '@testing-library/react';
import { OperationsCard } from '@/components/dashboard/OperationsCard';
it('counts payments and admissions without credit requests', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ stats: { pendingSubscriptionRequests: 2, pendingPayments: 3, pendingCreditRequests: 50, totalStudents: 10 }, todaySessions: [] }) });
  render(<OperationsCard />);
  const label = await screen.findByText('Demandes en attente');
  expect(within(label.parentElement!).getByText('5')).toBeInTheDocument();
});
