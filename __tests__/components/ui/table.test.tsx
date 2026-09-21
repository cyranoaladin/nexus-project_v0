/**
 * Table Component Tests
 *
 * Tests for semantic data table component
 */

import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';

describe('Table', () => {
  const renderBasicTable = () => {
    return render(
      <Table>
        <TableCaption>A list of invoices</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>INV001</TableCell>
            <TableCell>Paid</TableCell>
            <TableCell>$250.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>INV002</TableCell>
            <TableCell>Pending</TableCell>
            <TableCell>$150.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  describe('Rendering', () => {
    it('renders table with caption', () => {
      renderBasicTable();

      expect(screen.getByText('A list of invoices')).toBeInTheDocument();
    });

    it('renders table headers', () => {
      renderBasicTable();

      expect(screen.getByText('Invoice')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });

    it('renders table body cells', () => {
      renderBasicTable();

      expect(screen.getByText('INV001')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.getByText('INV002')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });

    it('renders with footer', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('has proper table semantic structure', () => {
      const { container } = renderBasicTable();

      const table = container.querySelector('table');
      const thead = container.querySelector('thead');
      const tbody = container.querySelector('tbody');
      const caption = container.querySelector('caption');

      expect(table).toBeInTheDocument();
      expect(thead).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();
      expect(caption).toBeInTheDocument();
    });

    it('renders th elements in header', () => {
      const { container } = renderBasicTable();

      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(3);
    });

    it('renders td elements in body', () => {
      const { container } = renderBasicTable();

      const cells = container.querySelectorAll('td');
      expect(cells).toHaveLength(6); // 2 rows × 3 cells
    });

    it('wraps table in scrollable container', () => {
      const { container } = renderBasicTable();

      const wrapper = container.querySelector('.overflow-auto');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct classes to table', () => {
      const { container } = renderBasicTable();

      const table = container.querySelector('table');
      expect(table).toHaveClass('w-full');
      expect(table).toHaveClass('caption-bottom');
    });

    it('applies hover styles to rows using a dark-surface token, not a light one', () => {
      // Every real consumer (HouseholdsWorkspace, AcademicYearsPanel, the
      // stages/assignments tables) renders on this app's dark surface
      // system (Card's default bg-surface-card) — hover:bg-neutral-50 (a
      // near-white fill) made a light-text row briefly illegible on hover.
      // surface-hover is this repo's own documented AAA-compliant choice
      // for exactly this state (app/globals.css's contrast guide).
      const { container } = renderBasicTable();

      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach(row => {
        expect(row).toHaveClass('hover:bg-surface-hover');
        expect(row.className).not.toMatch(/hover:bg-neutral-(50|100|200)\b/);
      });
    });

    it('applies a dark-surface footer background, not a light one', () => {
      const { container } = render(
        <Table>
          <TableFooter>
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      const footer = container.querySelector('tfoot');
      expect(footer).toHaveClass('bg-surface-elevated');
      expect(footer).toHaveClass('text-neutral-100');
      expect(footer?.className).not.toMatch(/bg-neutral-(50|100|200)\b/);
    });

    it('supports custom className on table', () => {
      const { container } = render(
        <Table className="custom-table">
          <TableBody>
            <TableRow>
              <TableCell>Test</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const table = container.querySelector('.custom-table');
      expect(table).toBeInTheDocument();
    });

    it('supports custom className on components', () => {
      const { container } = render(
        <Table>
          <TableHeader className="custom-header">
            <TableRow className="custom-row">
              <TableHead className="custom-head">Head</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="custom-body">
            <TableRow>
              <TableCell className="custom-cell">Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(container.querySelector('.custom-header')).toBeInTheDocument();
      expect(container.querySelector('.custom-row')).toBeInTheDocument();
      expect(container.querySelector('.custom-head')).toBeInTheDocument();
      expect(container.querySelector('.custom-body')).toBeInTheDocument();
      expect(container.querySelector('.custom-cell')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has semantic table elements', () => {
      renderBasicTable();

      // Table role is implicit for <table> element
      const { container } = renderBasicTable();
      const table = container.querySelector('table');
      expect(table?.tagName.toLowerCase()).toBe('table');
    });

    it('uses proper header cells', () => {
      const { container } = renderBasicTable();

      const headers = container.querySelectorAll('th');
      expect(headers.length).toBeGreaterThan(0);
      headers.forEach(header => {
        expect(header.tagName.toLowerCase()).toBe('th');
      });
    });

    it('has caption for screen readers', () => {
      const { container } = renderBasicTable();

      const caption = container.querySelector('caption');
      expect(caption).toBeInTheDocument();
      expect(caption?.textContent).toBe('A list of invoices');
    });
  });

  describe('Edge Cases', () => {
    it('renders empty table', () => {
      const { container } = render(
        <Table>
          <TableBody></TableBody>
        </Table>
      );

      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
    });

    it('renders table without caption', () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const caption = container.querySelector('caption');
      expect(caption).not.toBeInTheDocument();
    });

    it('handles single column table', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Single</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>One</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByText('Single')).toBeInTheDocument();
      expect(screen.getByText('One')).toBeInTheDocument();
    });

    it('handles many columns', () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Col1</TableHead>
              <TableHead>Col2</TableHead>
              <TableHead>Col3</TableHead>
              <TableHead>Col4</TableHead>
              <TableHead>Col5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>1</TableCell>
              <TableCell>2</TableCell>
              <TableCell>3</TableCell>
              <TableCell>4</TableCell>
              <TableCell>5</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const cells = container.querySelectorAll('td');
      expect(cells).toHaveLength(5);
    });

    it('handles data-state attribute on rows', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow data-state="selected">
              <TableCell>Selected</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const row = container.querySelector('[data-state="selected"]');
      expect(row).toBeInTheDocument();
      expect(row).toHaveClass('data-[state=selected]:bg-surface-elevated');
      expect(row?.className).not.toMatch(/data-\[state=selected\]:bg-neutral-(50|100|200)\b/);
    });
  });

  describe('Contrast (go-live mission Lot 1B — TableHead measured near-invisible on this app\'s dark surfaces before this fix)', () => {
    it('never emits the near-black header text that was illegible on every real (dark) consumer', () => {
      const { container } = renderBasicTable();
      const headers = container.querySelectorAll('th');
      expect(headers.length).toBeGreaterThan(0);
      headers.forEach((header) => {
        expect(header.className).not.toMatch(/text-neutral-900\b/);
        expect(header).toHaveClass('text-neutral-200');
      });
    });

    it('never emits the caption color this repo\'s own contrast guide lists as "avoid" on dark surfaces', () => {
      const { container } = renderBasicTable();
      const caption = container.querySelector('caption');
      expect(caption?.className).not.toMatch(/text-neutral-500\b/);
      expect(caption).toHaveClass('text-neutral-400');
    });

    it('cell and row borders use the app\'s dark-surface border convention, not a light-grey one', () => {
      const { container } = renderBasicTable();
      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row.className).not.toMatch(/border-neutral-200\b/);
        expect(row).toHaveClass('border-white/10');
      });
    });
  });

  describe('Complex Table', () => {
    it('renders complex table with all parts', () => {
      const { container } = render(
        <Table>
          <TableCaption>Monthly expenses</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Food</TableCell>
              <TableCell>$500</TableCell>
              <TableCell>2024-01-01</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Transport</TableCell>
              <TableCell>$200</TableCell>
              <TableCell>2024-01-01</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell>$700</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      expect(screen.getByText('Monthly expenses')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(container.querySelector('tfoot')).toBeInTheDocument();
    });
  });
});
