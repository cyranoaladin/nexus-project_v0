import { readFileSync } from 'fs';
import { join } from 'path';

import { CGV_POLICY, CGV_VERSION } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';

const root = process.cwd();

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

describe('centralized CGV policy', () => {
  test('checkout version is exported from the canonical CGV policy', () => {
    expect(CGV_VERSION).toBe(CGV_POLICY.versionLabel);
    expect(CGV_POLICY.payment.provider).toBe('ClicToPay');
    expect(CGV_POLICY.payment.bank).toBe(LEGAL.billing.bank);
    expect(CGV_POLICY.refunds.packs).toContain('14 jours');
  });

  test('active payment and legal surfaces consume the canonical CGV policy', () => {
    const legalAcceptance = sourceFor('components/checkout/LegalAcceptance.tsx');
    const conditions = sourceFor('app/conditions-generales/page.tsx');
    const mentionsLegales = sourceFor('app/mentions-legales/page.tsx');
    const paymentPage = sourceFor('app/dashboard/parent/paiement/page.tsx');
    const adminFacturation = sourceFor('app/dashboard/admin/facturation/page.tsx');
    const nexusInvoiceGenerator = sourceFor('components/facturation/NexusInvoiceGenerator.tsx');
    const adminTests = sourceFor('app/dashboard/admin/tests/page.tsx');

    expect(legalAcceptance).toContain('@/lib/cgv-policy');
    expect(conditions).toContain('@/lib/cgv-policy');
    expect(mentionsLegales).toContain('@/lib/cgv-policy');
    expect(paymentPage).toContain('@/lib/cgv-policy');
    expect(adminFacturation).toContain('@/lib/cgv-policy');
    expect(nexusInvoiceGenerator).toContain('@/lib/cgv-policy');
    expect(adminTests).toContain('@/lib/cgv-policy');
    expect(legalAcceptance).not.toMatch(/export const CGV_VERSION\s*=/);
    expect(legalAcceptance).not.toMatch(/export \{ CGV_VERSION \}/);
    expect(conditions).not.toMatch(/const CGV_VERSION\s*=/);
  });

  test('refund request wording is self-contained in the canonical policy', () => {
    expect(CGV_POLICY.refunds.request).toMatch(/^Les demandes de remboursement/i);
    expect(CGV_POLICY.refunds.request).toMatch(/motif/i);
    expect(CGV_POLICY.refunds.request).toMatch(/référence/i);
  });
});
