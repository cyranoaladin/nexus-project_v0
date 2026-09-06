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

describe('cancellation terms without credit accounting', () => {
  test('publishes a distinct version rather than rewriting the accepted March terms', () => {
    expect(CGV_POLICY.version).toBe('1.1');
    expect(CGV_VERSION).toBe('CGV v1.1 – 2026-09-06');
    expect(CGV_POLICY.effectiveDateLabel).toBe('6 septembre 2026');
  });
  test('does not promise automatic credit restitution or a credit-based late penalty', () => {
    const source = sourceFor('app/conditions-generales/page.tsx');
    expect(source).not.toMatch(/avec crédits de séances|crédits inclus|Séances individuelles \(crédits\)|crédit de séance est considéré|crédit est automatiquement restitué|crédits non consommés/i);
    expect(source).toContain('ne déclenche pas de remboursement automatique');
    expect(source).toContain('Un report est proposé prioritairement');
  });
  test('preserves cancellation or rescheduling without penalty at least 24 hours before an individual session', () => {
    const source = sourceFor('app/conditions-generales/page.tsx');
    const individualTerms = source.split('7.1 Séances individuelles')[1].split('7.2 Abonnements')[0];
    expect(individualTerms).toMatch(/Annulation ou report[\s\S]*24 heures[\s\S]*sans pénalité/);
    expect(individualTerms).toContain('conditions acceptées lors de la commande');
  });
  test('preserves acquired services and previously accepted cancellation terms', () => {
    const source = sourceFor('app/conditions-generales/page.tsx');
    expect(source).toContain('prestations déjà acquises');
    expect(source).toContain('conditions acceptées lors de la commande');
    expect(source).toContain('délais, reports et droits antérieurement convenus');
    expect(source).toContain('Les modifications ne s&apos;appliquent pas aux commandes déjà validées.');
  });
});
