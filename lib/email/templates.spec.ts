import { describe, expect, it } from 'vitest';

import { tplCashCancelled, tplCashConfirmed, tplCashReserved } from './templates';

describe('email templates', () => {
  it('tplCashReserved returns branded HTML', () => {
    const html = tplCashReserved({ amountTnd: 123, recordId: 42 });
    expect(html).toContain('Nexus');
    expect(html).toContain('Réservation cash');
    expect(html).toContain('PR-42');
    expect(html).toContain('123');
  });

  it('tplCashConfirmed returns branded HTML', () => {
    const html = tplCashConfirmed({ recordId: 77 });
    expect(html).toContain('Paiement validé');
    expect(html).toContain('PR-77');
  });

  it('tplCashCancelled returns branded HTML', () => {
    const html = tplCashCancelled({ recordId: 9 });
    expect(html).toContain('Réservation annulée');
    expect(html).toContain('PR-9');
  });
})
