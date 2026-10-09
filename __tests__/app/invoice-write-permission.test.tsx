import { render, screen } from '@testing-library/react';
import InvoicePage from '@/app/dashboard/admin/facturation/page';
const mockFetch = jest.fn();
const mockSession = jest.fn();
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useProtectedFetch: () => mockFetch, useCanonicalSession: () => mockSession(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ invoices: [{
    id: 'synthetic-invoice', number: 'SYNTHETIC-INVOICE', status: 'SENT', issuedAt: '2026-10-04T10:00:00Z',
    dueAt: null, customerName: 'Synthetic invoice customer', customerEmail: null, currency: 'TND',
    subtotal: 1000, discountTotal: 0, total: 1000, pdfUrl: '/api/invoices/synthetic-invoice/pdf', items: [],
  }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }) });
});
it('assistant reads invoices and download link without create/pay/cancel controls', async () => {
  mockSession.mockReturnValue({ data: { user: { id: 'synthetic-staff', role: 'ASSISTANTE' } } });
  render(<InvoicePage />);
  expect(await screen.findByText('Synthetic invoice customer')).toBeInTheDocument();
  expect(screen.getByTitle('Télécharger PDF')).toHaveAttribute('href', '/api/invoices/synthetic-invoice/pdf');
  expect(screen.queryByRole('button', { name: /Nouvelle facture/ })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Marquer payée')).not.toBeInTheDocument();
  expect(screen.queryByTitle('Annuler')).not.toBeInTheDocument();
});
it('authorized admin retains invoice creation and status controls', async () => {
  mockSession.mockReturnValue({ data: { user: { id: 'synthetic-admin', role: 'ADMIN' } } });
  render(<InvoicePage />);
  expect(await screen.findByText('Synthetic invoice customer')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Nouvelle facture/ })).toBeInTheDocument();
  expect(screen.getByTitle('Marquer payée')).toBeInTheDocument();
  expect(screen.getByTitle('Annuler')).toBeInTheDocument();
});
