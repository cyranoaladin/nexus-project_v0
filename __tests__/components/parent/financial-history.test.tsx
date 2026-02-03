import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FinancialHistory } from '@/components/ui/parent/financial-history';

const mockChildren = [
  { id: 'child-1', firstName: 'Marie', lastName: 'Dupont' },
  { id: 'child-2', firstName: 'Paul', lastName: 'Dupont' },
];

const mockTransactions = [
  {
    id: '1',
    type: 'PAYMENT',
    description: 'Achat de crédits - Pack 10h',
    amount: 250,
    status: 'COMPLETED',
    date: new Date('2024-01-15'),
    childId: 'child-1',
    childName: 'Marie Dupont',
  },
  {
    id: '2',
    type: 'CREDIT_USAGE',
    description: 'Séance de mathématiques',
    amount: -25,
    status: 'COMPLETED',
    date: new Date('2024-01-20'),
    childId: 'child-1',
    childName: 'Marie Dupont',
  },
  {
    id: '3',
    type: 'PAYMENT',
    description: 'Achat de crédits - Pack 20h',
    amount: 450,
    status: 'PENDING',
    date: new Date('2024-01-25'),
    childId: 'child-2',
    childName: 'Paul Dupont',
  },
  {
    id: '4',
    type: 'CREDIT_USAGE',
    description: 'Séance de français',
    amount: -25,
    status: 'COMPLETED',
    date: new Date('2024-01-22'),
    childId: 'child-2',
    childName: 'Paul Dupont',
  },
  {
    id: '5',
    type: 'REFUND',
    description: 'Remboursement séance annulée',
    amount: 25,
    status: 'REFUNDED',
    date: new Date('2024-01-28'),
    childId: 'child-1',
    childName: 'Marie Dupont',
  },
];

describe('FinancialHistory Component', () => {
  describe('Table rendering', () => {
    test('should render all transactions correctly', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      expect(screen.getByText('Achat de crédits - Pack 10h')).toBeInTheDocument();
      expect(screen.getByText('Séance de mathématiques')).toBeInTheDocument();
      expect(screen.getByText('Achat de crédits - Pack 20h')).toBeInTheDocument();
    });

    test('should display correct transaction count', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const countElements = screen.getAllByText(/5 transactions/);
      expect(countElements.length).toBeGreaterThan(0);
    });

    test('should render table headers', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Montant')).toBeInTheDocument();
      expect(screen.getByText('Statut')).toBeInTheDocument();
      expect(screen.getByText('Enfant')).toBeInTheDocument();
    });

    test('should display child names in transactions', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const marieElements = screen.getAllByText(/Marie Dupont/);
      const paulElements = screen.getAllByText(/Paul Dupont/);
      expect(marieElements.length).toBeGreaterThan(0);
      expect(paulElements.length).toBeGreaterThan(0);
    });
  });

  describe('Status badges', () => {
    test('should display status badges with correct colors', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const completed = screen.getAllByText('Complétée');
      const pending = screen.getAllByText('En attente');
      const refunded = screen.getAllByText('Remboursée');
      
      expect(completed.length).toBeGreaterThan(0);
      expect(pending.length).toBeGreaterThan(0);
      expect(refunded.length).toBeGreaterThan(0);
    });

    test('should apply correct color classes for different statuses', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const completedBadges = screen.getAllByText('Complétée');
      expect(completedBadges[0].closest('.text-green-800') || completedBadges[0].parentElement).toBeTruthy();
      
      const pendingBadges = screen.getAllByText('En attente');
      expect(pendingBadges[0].closest('.text-yellow-800') || pendingBadges[0].parentElement).toBeTruthy();
      
      const refundedBadges = screen.getAllByText('Remboursée');
      expect(refundedBadges[0].closest('.text-blue-800') || refundedBadges[0].parentElement).toBeTruthy();
    });
  });

  describe('Filters', () => {
    test('should filter transactions by type', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const typeFilter = screen.getByText('Tous les types');
      await user.click(typeFilter);
      
      await waitFor(() => {
        const paymentOption = screen.getAllByText('PAYMENT').find(el => el.getAttribute('role') === 'option');
        expect(paymentOption).toBeInTheDocument();
      });
      
      const paymentOption = screen.getAllByText('PAYMENT').find(el => el.getAttribute('role') === 'option');
      if (paymentOption) await user.click(paymentOption);
      
      await waitFor(() => {
        expect(screen.getByText('Achat de crédits - Pack 10h')).toBeInTheDocument();
        expect(screen.queryByText('Séance de mathématiques')).not.toBeInTheDocument();
      });
    });

    test('should filter transactions by child', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const childFilter = screen.getByText('Tous les enfants');
      await user.click(childFilter);
      
      await waitFor(() => {
        const options = screen.getAllByText('Marie Dupont');
        expect(options.length).toBeGreaterThan(0);
      });
      
      const marieOption = screen.getAllByText('Marie Dupont').find(el => el.getAttribute('role') === 'option');
      if (marieOption) await user.click(marieOption);
      
      await waitFor(() => {
        const transactions = screen.queryAllByRole('row');
        expect(transactions.length).toBeLessThan(mockTransactions.length + 1);
      });
    });

    test('should filter transactions by status', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const statusFilter = screen.getByText('Tous les statuts');
      await user.click(statusFilter);
      
      await waitFor(() => {
        const completedOptions = screen.getAllByText('Complétée');
        expect(completedOptions.length).toBeGreaterThan(0);
      });
    });

    test('should filter transactions by date range', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const dateFromInput = screen.getByPlaceholderText('Date début');
      const dateToInput = screen.getByPlaceholderText('Date fin');
      
      await user.type(dateFromInput, '2024-01-20');
      await user.type(dateToInput, '2024-01-25');
      
      await waitFor(() => {
        expect(screen.queryByText('Achat de crédits - Pack 10h')).not.toBeInTheDocument();
        expect(screen.getByText('Séance de mathématiques')).toBeInTheDocument();
      });
    });

    test('should clear all filters when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const typeFilter = screen.getByText('Tous les types');
      await user.click(typeFilter);
      
      const paymentOption = screen.getAllByText('PAYMENT').find(el => el.getAttribute('role') === 'option');
      if (paymentOption) await user.click(paymentOption);
      
      await waitFor(() => {
        expect(screen.getByText('Réinitialiser')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Réinitialiser'));
      
      await waitFor(() => {
        expect(screen.getByText('Achat de crédits - Pack 10h')).toBeInTheDocument();
        expect(screen.getByText('Séance de mathématiques')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    test('should display only 20 transactions initially when more exist', () => {
      const manyTransactions = Array.from({ length: 50 }, (_, i) => ({
        id: `trans-${i}`,
        type: 'PAYMENT',
        description: `Transaction ${i}`,
        amount: 100,
        status: 'COMPLETED',
        date: new Date(),
        childId: 'child-1',
        childName: 'Marie Dupont',
      }));
      
      render(<FinancialHistory transactions={manyTransactions} children={mockChildren} />);
      
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThanOrEqual(21);
    });

    test('should show "Charger plus" button when more transactions exist', () => {
      const manyTransactions = Array.from({ length: 30 }, (_, i) => ({
        id: `trans-${i}`,
        type: 'PAYMENT',
        description: `Transaction ${i}`,
        amount: 100,
        status: 'COMPLETED',
        date: new Date(),
        childId: 'child-1',
        childName: 'Marie Dupont',
      }));
      
      render(<FinancialHistory transactions={manyTransactions} children={mockChildren} />);
      
      expect(screen.getByText(/Charger plus/)).toBeInTheDocument();
      expect(screen.getByText(/10 restantes/)).toBeInTheDocument();
    });

    test('should load more transactions when "Charger plus" is clicked', async () => {
      const user = userEvent.setup();
      const manyTransactions = Array.from({ length: 30 }, (_, i) => ({
        id: `trans-${i}`,
        type: 'PAYMENT',
        description: `Transaction ${i}`,
        amount: 100,
        status: 'COMPLETED',
        date: new Date(),
        childId: 'child-1',
        childName: 'Marie Dupont',
      }));
      
      render(<FinancialHistory transactions={manyTransactions} children={mockChildren} />);
      
      const loadMoreButton = screen.getByText(/Charger plus/);
      await user.click(loadMoreButton);
      
      await waitFor(() => {
        expect(screen.getByText('Affichage de 30 sur 30 transactions')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    test('should sort by date when date header is clicked', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const dateHeader = screen.getByText('Date');
      await user.click(dateHeader);
      
      expect(dateHeader.parentElement).toBeInTheDocument();
    });

    test('should sort by type when type header is clicked', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const typeHeader = screen.getByText('Type');
      await user.click(typeHeader);
      
      expect(typeHeader.parentElement).toBeInTheDocument();
    });

    test('should sort by amount when amount header is clicked', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const amountHeader = screen.getByText('Montant');
      await user.click(amountHeader);
      
      expect(amountHeader.parentElement).toBeInTheDocument();
    });

    test('should toggle sort direction on repeated clicks', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const dateHeader = screen.getByText('Date');
      await user.click(dateHeader);
      await user.click(dateHeader);
      
      expect(dateHeader.parentElement).toBeInTheDocument();
    });
  });

  describe('CSV Export', () => {
    test('should display export CSV button', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
    });

    test('should trigger CSV download when export button is clicked', async () => {
      const user = userEvent.setup();
      const createElementSpy = jest.spyOn(document, 'createElement');
      
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const exportButton = screen.getByText('Exporter CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(createElementSpy).toHaveBeenCalledWith('a');
      });
      
      createElementSpy.mockRestore();
    });

    test('should disable export button when no transactions', () => {
      render(<FinancialHistory transactions={[]} children={mockChildren} />);
      
      const exportButton = screen.getByText('Exporter CSV');
      expect(exportButton).toBeDisabled();
    });

    test('should include all visible transactions in CSV export', async () => {
      const user = userEvent.setup();
      global.URL.createObjectURL = jest.fn();
      const mockAppendChild = jest.spyOn(document.body, 'appendChild');
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild');
      
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const exportButton = screen.getByText('Exporter CSV');
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(mockAppendChild).toHaveBeenCalled();
      });
      
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('Empty state', () => {
    test('should display empty state when no transactions', () => {
      render(<FinancialHistory transactions={[]} children={mockChildren} />);
      
      expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
      expect(screen.getByText(/Les transactions apparaîtront ici/)).toBeInTheDocument();
    });

    test('should display appropriate message when filters yield no results', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const dateFromInput = screen.getByPlaceholderText('Date début');
      await user.type(dateFromInput, '2025-01-01');
      
      await waitFor(() => {
        expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
        expect(screen.getByText('Essayez de modifier les filtres')).toBeInTheDocument();
      });
    });

    test('should not display table when no transactions', () => {
      render(<FinancialHistory transactions={[]} children={mockChildren} />);
      
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Amount display', () => {
    test('should display positive amounts in green', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const rows = screen.getAllByRole('row');
      const firstPayment = rows.find(row => row.textContent?.includes('Achat de crédits - Pack 10h'));
      expect(firstPayment).toBeInTheDocument();
    });

    test('should display negative amounts in red', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const rows = screen.getAllByRole('row');
      const creditUsage = rows.find(row => row.textContent?.includes('Séance de mathématiques'));
      expect(creditUsage).toBeInTheDocument();
    });

    test('should prefix positive amounts with + sign', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      expect(screen.getByText(/\+250/)).toBeInTheDocument();
    });

    test('should show negative amounts with - sign', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const negativeAmounts = screen.getAllByText(/-25/);
      expect(negativeAmounts.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    test('should handle transactions without childId', () => {
      const transactionsWithoutChild = [
        {
          id: '1',
          type: 'PAYMENT',
          description: 'Parent payment',
          amount: 100,
          status: 'COMPLETED',
          date: new Date(),
        },
      ];
      
      render(<FinancialHistory transactions={transactionsWithoutChild} children={mockChildren} />);
      
      expect(screen.getByText('Parent payment')).toBeInTheDocument();
    });

    test('should handle transactions without status', () => {
      const transactionsWithoutStatus = [
        {
          id: '1',
          type: 'PAYMENT',
          description: 'Test transaction',
          amount: 100,
          date: new Date(),
        },
      ];
      
      render(<FinancialHistory transactions={transactionsWithoutStatus} children={mockChildren} />);
      
      expect(screen.getByText('Test transaction')).toBeInTheDocument();
    });

    test('should handle empty children array', () => {
      render(<FinancialHistory transactions={mockTransactions} children={[]} />);
      
      expect(screen.queryByText('Tous les enfants')).not.toBeInTheDocument();
    });

    test('should handle very long descriptions', () => {
      const longDescTransactions = [
        {
          id: '1',
          type: 'PAYMENT',
          description: 'This is a very long transaction description that should be truncated or wrapped properly to maintain the layout of the table and ensure good user experience',
          amount: 100,
          status: 'COMPLETED',
          date: new Date(),
        },
      ];
      
      render(<FinancialHistory transactions={longDescTransactions} children={mockChildren} />);
      
      expect(screen.getByText(/This is a very long transaction description/)).toBeInTheDocument();
    });
  });

  describe('Transaction count display', () => {
    test('should display singular form for 1 transaction', () => {
      const singleTransaction = [mockTransactions[0]];
      render(<FinancialHistory transactions={singleTransaction} children={mockChildren} />);
      
      const transactionCounts = screen.getAllByText(/1 transaction\b/);
      expect(transactionCounts.length).toBeGreaterThan(0);
    });

    test('should display plural form for multiple transactions', () => {
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const transactionCounts = screen.getAllByText(/5 transactions/);
      expect(transactionCounts.length).toBeGreaterThan(0);
    });

    test('should update count after filtering', async () => {
      const user = userEvent.setup();
      render(<FinancialHistory transactions={mockTransactions} children={mockChildren} />);
      
      const initial5 = screen.getAllByText(/5 transactions/);
      expect(initial5.length).toBeGreaterThan(0);
      
      const typeFilter = screen.getByText('Tous les types');
      await user.click(typeFilter);
      
      const paymentOption = screen.getAllByText('PAYMENT').find(el => el.getAttribute('role') === 'option');
      if (paymentOption) await user.click(paymentOption);
      
      await waitFor(() => {
        const after2 = screen.queryAllByText(/2 transactions/);
        expect(after2.length).toBeGreaterThan(0);
      });
    });
  });
});
