/**
 * Unit tests for Invoice Status Transition Engine.
 *
 * Tests the pure transition validator, RBAC helpers, and available actions.
 * No DB, no API — pure logic only.
 */

import {
  validateTransition,
  canPerformStatusAction,
  getTargetStatus,
  isTerminalStatus,
  getAvailableActions,
} from '@/lib/invoice/transitions';
import type { MarkPaidMeta, CancelMeta } from '@/lib/invoice/transitions';

// ─── Transition Graph Tests ─────────────────────────────────────────────────

describe('validateTransition — transition graph', () => {
  describe('DRAFT transitions', () => {
    it('DRAFT → MARK_SENT = SENT', () => {
      const result = validateTransition('DRAFT', 'MARK_SENT');
      expect(result.valid).toBe(true);
      expect(result.targetStatus).toBe('SENT');
    });

    it('DRAFT → CANCEL = CANCELLED', () => {
      const result = validateTransition('DRAFT', 'CANCEL');
      expect(result.valid).toBe(true);
      expect(result.targetStatus).toBe('CANCELLED');
    });

    it('DRAFT → MARK_PAID = invalid (409)', () => {
      const result = validateTransition('DRAFT', 'MARK_PAID');
      expect(result.valid).toBe(false);
      expect(result.httpStatus).toBe(409);
    });
  });

  describe('SENT transitions', () => {
    it('SENT → MARK_PAID = PAID (with valid payment)', () => {
      const meta: MarkPaidMeta = {
        payment: { method: 'BANK_TRANSFER', amountPaid: 350000 },
      };
      const result = validateTransition('SENT', 'MARK_PAID', meta, 350000);
      expect(result.valid).toBe(true);
      expect(result.targetStatus).toBe('PAID');
    });

    it('SENT → CANCEL = CANCELLED', () => {
      const result = validateTransition('SENT', 'CANCEL');
      expect(result.valid).toBe(true);
      expect(result.targetStatus).toBe('CANCELLED');
    });

    it('SENT → MARK_SENT = noop (idempotent)', () => {
      const result = validateTransition('SENT', 'MARK_SENT');
      expect(result.valid).toBe(true);
      expect(result.noop).toBe(true);
    });
  });

  describe('Terminal statuses', () => {
    it('PAID → non-idempotent actions = invalid (409)', () => {
      expect(validateTransition('PAID', 'MARK_SENT').valid).toBe(false);
      expect(validateTransition('PAID', 'CANCEL').valid).toBe(false);
    });

    it('PAID → MARK_PAID = noop (idempotent)', () => {
      const result = validateTransition('PAID', 'MARK_PAID');
      expect(result.valid).toBe(true);
      expect(result.noop).toBe(true);
    });

    it('PAID error message mentions terminal', () => {
      const result = validateTransition('PAID', 'CANCEL');
      expect(result.error).toContain('payée');
      expect(result.httpStatus).toBe(409);
    });

    it('CANCELLED → non-idempotent actions = invalid (409)', () => {
      expect(validateTransition('CANCELLED', 'MARK_SENT').valid).toBe(false);
      expect(validateTransition('CANCELLED', 'MARK_PAID').valid).toBe(false);
    });

    it('CANCELLED → CANCEL = noop (idempotent)', () => {
      const result = validateTransition('CANCELLED', 'CANCEL');
      expect(result.valid).toBe(true);
      expect(result.noop).toBe(true);
    });

    it('CANCELLED error message mentions terminal', () => {
      const result = validateTransition('CANCELLED', 'MARK_SENT');
      expect(result.error).toContain('annulée');
      expect(result.httpStatus).toBe(409);
    });
  });
});

// ─── Idempotence (double-click protection) ──────────────────────────────────

describe('validateTransition — idempotence', () => {
  it('MARK_SENT on SENT → noop (200, no event)', () => {
    const result = validateTransition('SENT', 'MARK_SENT');
    expect(result.valid).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.targetStatus).toBe('SENT');
  });

  it('MARK_PAID on PAID → noop', () => {
    const result = validateTransition('PAID', 'MARK_PAID');
    expect(result.valid).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.targetStatus).toBe('PAID');
  });

  it('CANCEL on CANCELLED → noop', () => {
    const result = validateTransition('CANCELLED', 'CANCEL');
    expect(result.valid).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.targetStatus).toBe('CANCELLED');
  });

  it('MARK_SENT on DRAFT → NOT noop (real transition)', () => {
    const result = validateTransition('DRAFT', 'MARK_SENT');
    expect(result.valid).toBe(true);
    expect(result.noop).toBeUndefined();
    expect(result.targetStatus).toBe('SENT');
  });
});

// ─── MARK_PAID Validation ───────────────────────────────────────────────────

describe('validateTransition — MARK_PAID validation', () => {
  it('rejects missing payment metadata (422)', () => {
    const result = validateTransition('SENT', 'MARK_PAID');
    expect(result.valid).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.error).toContain('paiement');
  });

  it('rejects empty payment object (422)', () => {
    const result = validateTransition('SENT', 'MARK_PAID', {} as MarkPaidMeta);
    expect(result.valid).toBe(false);
    expect(result.httpStatus).toBe(422);
  });

  it('rejects float amountPaid (422)', () => {
    const meta: MarkPaidMeta = {
      payment: { method: 'CASH', amountPaid: 350.5 },
    };
    const result = validateTransition('SENT', 'MARK_PAID', meta, 350000);
    expect(result.valid).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.error).toContain('entier');
  });

  it('rejects amountPaid !== total (strict, 422)', () => {
    const meta: MarkPaidMeta = {
      payment: { method: 'CASH', amountPaid: 300000 },
    };
    const result = validateTransition('SENT', 'MARK_PAID', meta, 350000);
    expect(result.valid).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.error).toContain('paiement complet');
  });

  it('rejects missing payment method (422)', () => {
    const meta: MarkPaidMeta = {
      payment: { method: '', amountPaid: 350000 },
    };
    const result = validateTransition('SENT', 'MARK_PAID', meta, 350000);
    expect(result.valid).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.error).toContain('mode de paiement');
  });

  it('accepts valid payment with all fields', () => {
    const meta: MarkPaidMeta = {
      payment: {
        method: 'BANK_TRANSFER',
        reference: 'VIR-2026-0042',
        paidAt: '2026-02-16T10:00:00.000Z',
        amountPaid: 350000,
      },
    };
    const result = validateTransition('SENT', 'MARK_PAID', meta, 350000);
    expect(result.valid).toBe(true);
    expect(result.targetStatus).toBe('PAID');
  });

  it('accepts valid payment without optional fields', () => {
    const meta: MarkPaidMeta = {
      payment: { method: 'CASH', amountPaid: 100000 },
    };
    const result = validateTransition('SENT', 'MARK_PAID', meta, 100000);
    expect(result.valid).toBe(true);
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────────

describe('canPerformStatusAction — RBAC', () => {
  it('ADMIN can perform status actions', () => {
    expect(canPerformStatusAction('ADMIN')).toBe(true);
  });

  it('ASSISTANTE can perform status actions', () => {
    expect(canPerformStatusAction('ASSISTANTE')).toBe(true);
  });

  it('PARENT cannot perform status actions', () => {
    expect(canPerformStatusAction('PARENT')).toBe(false);
  });

  it('ELEVE cannot perform status actions', () => {
    expect(canPerformStatusAction('ELEVE')).toBe(false);
  });

  it('COACH cannot perform status actions', () => {
    expect(canPerformStatusAction('COACH')).toBe(false);
  });

  it('undefined role cannot perform status actions', () => {
    expect(canPerformStatusAction(undefined)).toBe(false);
  });
});

// ─── Helper Functions ───────────────────────────────────────────────────────

describe('getTargetStatus', () => {
  it('returns SENT for DRAFT + MARK_SENT', () => {
    expect(getTargetStatus('DRAFT', 'MARK_SENT')).toBe('SENT');
  });

  it('returns PAID for SENT + MARK_PAID', () => {
    expect(getTargetStatus('SENT', 'MARK_PAID')).toBe('PAID');
  });

  it('returns CANCELLED for DRAFT + CANCEL', () => {
    expect(getTargetStatus('DRAFT', 'CANCEL')).toBe('CANCELLED');
  });

  it('returns null for invalid transition', () => {
    expect(getTargetStatus('PAID', 'CANCEL')).toBeNull();
    expect(getTargetStatus('CANCELLED', 'MARK_SENT')).toBeNull();
  });
});

describe('isTerminalStatus', () => {
  it('PAID is terminal', () => {
    expect(isTerminalStatus('PAID')).toBe(true);
  });

  it('CANCELLED is terminal', () => {
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  it('DRAFT is not terminal', () => {
    expect(isTerminalStatus('DRAFT')).toBe(false);
  });

  it('SENT is not terminal', () => {
    expect(isTerminalStatus('SENT')).toBe(false);
  });
});

describe('getAvailableActions', () => {
  it('DRAFT has MARK_SENT and CANCEL', () => {
    const actions = getAvailableActions('DRAFT');
    expect(actions).toContain('MARK_SENT');
    expect(actions).toContain('CANCEL');
    expect(actions).toHaveLength(2);
  });

  it('SENT has MARK_PAID and CANCEL', () => {
    const actions = getAvailableActions('SENT');
    expect(actions).toContain('MARK_PAID');
    expect(actions).toContain('CANCEL');
    expect(actions).toHaveLength(2);
  });

  it('PAID has no actions', () => {
    expect(getAvailableActions('PAID')).toHaveLength(0);
  });

  it('CANCELLED has no actions', () => {
    expect(getAvailableActions('CANCELLED')).toHaveLength(0);
  });
});
