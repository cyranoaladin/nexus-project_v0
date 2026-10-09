import { isPublishedInvoice } from '@/lib/invoice/publication';
import { validateTransition } from '@/lib/invoice/transitions';

const sent = { type: 'INVOICE_SENT', at: '2026-10-01T00:00:00.000Z', by: 'synthetic-staff' };
const created = { type: 'INVOICE_CREATED', at: '2026-10-01T00:00:00.000Z', by: 'synthetic-staff' };
const cancelled = { type: 'INVOICE_CANCELLED', at: '2026-10-02T00:00:00.000Z', by: 'synthetic-staff' };

describe('invoice publication boundary', () => {
  test('a draft can be cancelled without ever being sent', () => {
    expect(validateTransition('DRAFT', 'CANCEL')).toMatchObject({ valid: true, targetStatus: 'CANCELLED' });
  });

  test.each(['SENT', 'PAID'])('%s is published by construction', status => {
    expect(isPublishedInvoice({ status, events: [] })).toBe(true);
  });

  test.each([
    ['DRAFT', [sent]],
    [null, [sent]],
    [undefined, [sent]],
    ['UNKNOWN', [sent]],
  ])('status %s is never published', (status, events) => {
    expect(isPublishedInvoice({ status, events })).toBe(false);
  });

  test.each([
    ['without events', []],
    ['with events that never include a send', [created, cancelled]],
    ['with a malformed event log', 'INVOICE_SENT'],
    ['with null entries', [null, cancelled]],
    ['with a lookalike send event', [{ type: 'INVOICE_SENT_EMAIL' }, { type: 'invoice_sent' }]],
    ['with no event log', undefined],
  ])('a cancelled draft %s stays private', (_label, events) => {
    expect(isPublishedInvoice({ status: 'CANCELLED', events })).toBe(false);
  });

  test('a cancelled invoice that was sent first stays visible to its family', () => {
    expect(isPublishedInvoice({ status: 'CANCELLED', events: [created, sent, cancelled] })).toBe(true);
  });
});
