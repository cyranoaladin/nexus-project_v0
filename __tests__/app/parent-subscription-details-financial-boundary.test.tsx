import { fireEvent, render, screen } from '@testing-library/react';
import InvoiceDetailsDialog from '@/app/dashboard/parent/invoice-details-dialog';
it('family subscription details do not display a legacy private price even if a stale payload includes it', async () => {
  const details = { planName: 'Synthetic plan', status: 'ACTIVE', startDate: '2026-10-01T00:00:00Z',
    endDate: null, monthlyPrice: 424242 };
  render(<InvoiceDetailsDialog subscriptionDetails={details} studentName="Synthetic fixture" />);
  fireEvent.click(screen.getByRole('button', { name: 'Voir les détails' }));
  expect(await screen.findByText('Synthetic plan')).toBeInTheDocument();
  expect(screen.queryByText(/424242/)).not.toBeInTheDocument();
});
