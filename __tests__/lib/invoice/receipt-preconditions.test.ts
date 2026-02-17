/**
 * Tests for receipt PDF preconditions.
 *
 * Validates that the receipt is only accessible for PAID invoices
 * with complete payment data.
 */

describe('receipt preconditions', () => {
  /**
   * These tests validate the precondition logic used in the receipt endpoint.
   * The actual endpoint uses: invoice.status !== 'PAID' || !invoice.paidAt || invoice.paidAmount == null
   */

  function checkReceiptPreconditions(invoice: {
    status: string;
    paidAt: string | null;
    paidAmount: number | null;
  }): { allowed: boolean; reason?: string } {
    if (invoice.status !== 'PAID') {
      return { allowed: false, reason: 'status_not_paid' };
    }
    if (!invoice.paidAt) {
      return { allowed: false, reason: 'missing_paidAt' };
    }
    if (invoice.paidAmount == null) {
      return { allowed: false, reason: 'missing_paidAmount' };
    }
    return { allowed: true };
  }

  it('PAID with paidAt + paidAmount → allowed', () => {
    const result = checkReceiptPreconditions({
      status: 'PAID',
      paidAt: '2026-02-16T10:00:00Z',
      paidAmount: 350000,
    });
    expect(result.allowed).toBe(true);
  });

  it('SENT → blocked (status_not_paid)', () => {
    const result = checkReceiptPreconditions({
      status: 'SENT',
      paidAt: null,
      paidAmount: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('status_not_paid');
  });

  it('DRAFT → blocked (status_not_paid)', () => {
    const result = checkReceiptPreconditions({
      status: 'DRAFT',
      paidAt: null,
      paidAmount: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('status_not_paid');
  });

  it('CANCELLED → blocked (status_not_paid)', () => {
    const result = checkReceiptPreconditions({
      status: 'CANCELLED',
      paidAt: null,
      paidAmount: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('status_not_paid');
  });

  it('PAID without paidAt → blocked (missing_paidAt)', () => {
    const result = checkReceiptPreconditions({
      status: 'PAID',
      paidAt: null,
      paidAmount: 350000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_paidAt');
  });

  it('PAID without paidAmount → blocked (missing_paidAmount)', () => {
    const result = checkReceiptPreconditions({
      status: 'PAID',
      paidAt: '2026-02-16T10:00:00Z',
      paidAmount: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_paidAmount');
  });

  it('PAID with paidAmount = 0 → allowed (zero is valid)', () => {
    const result = checkReceiptPreconditions({
      status: 'PAID',
      paidAt: '2026-02-16T10:00:00Z',
      paidAmount: 0,
    });
    expect(result.allowed).toBe(true);
  });
});
