import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PreRentreeOperationsSchema } from '@/lib/campaigns/pre-rentree-2026/content-schema';

const root = process.cwd();

describe('Pré-rentrée 2026 operational review contract', () => {
  it('defines eleven anonymous review forms and the complete CRM workflow', () => {
    const source = JSON.parse(readFileSync(
      join(root, 'content/pre-rentree-2026/operations.fr.json'),
      'utf8',
    ));
    const operations = PreRentreeOperationsSchema.parse(source);

    expect(operations.reviewForms).toHaveLength(11);
    expect(operations.reviewForms.every((form) => form.fields.length > 0)).toBe(true);
    expect(operations.crm.statuses).toEqual([
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROGRAM_SENT',
      'PATH_PROPOSED',
      'PENDING_DEPOSIT',
      'RESERVED',
      'WAITLIST',
      'GROUP_CONFIRMED',
      'BALANCE_PENDING',
      'FULLY_PAID',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
    ]);
    expect(operations.crm.fields.map((field) => field.id)).toEqual(expect.arrayContaining([
      'leadId', 'source', 'level', 'subjects', 'range', 'status', 'amount',
      'expectedDeposit', 'receivedDeposit', 'reservationDate', 'balance',
      'manualEligible', 'manualDelivered', 'outcome',
    ]));
  });

  it('keeps economic cost assumptions explicit and unset in source control', () => {
    const source = JSON.parse(readFileSync(
      join(root, 'content/pre-rentree-2026/operations.fr.json'),
      'utf8',
    ));
    const operations = PreRentreeOperationsSchema.parse(source);

    expect(operations.economicModel.currency).toBe('TND');
    expect(operations.economicModel.inputs.length).toBeGreaterThanOrEqual(15);
    expect(operations.economicModel.inputs.every((input) => input.value === null)).toBe(true);
    expect(operations.economicModel.acquisitionScenarios.map((scenario) => scenario.id)).toEqual([
      'LOW', 'MEDIUM', 'HIGH',
    ]);
  });
});
