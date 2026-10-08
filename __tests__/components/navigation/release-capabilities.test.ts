import { getNavigationItems } from '@/components/navigation/navigation-config';

const user = (role: 'PARENT' | 'COACH' | 'ELEVE', authority: 'CORE_V2' | 'V1') => ({ role, authority });
const previous = process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER;
afterEach(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER; else process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER = previous; });

test('payments are absent by default while existing invoices remain accessible', () => {
  delete process.env.NEXT_PUBLIC_ENABLE_BANK_TRANSFER;
  const links = getNavigationItems(user('PARENT', 'V1')).map(item => item.href);
  expect(links).not.toContain('/dashboard/parent/paiement');
  expect(links).toContain('/dashboard/parent/factures');
});

test('Core coach navigation does not advertise V1 profiles or schedules', () => {
  const links = getNavigationItems(user('COACH', 'CORE_V2')).map(item => item.href);
  expect(links).toContain('/dashboard/coach');
  for (const path of ['sessions', 'students', 'availability']) expect(links).not.toContain('/dashboard/coach/' + path);
  expect(getNavigationItems(user('COACH', 'V1')).map(item => item.href)).toContain('/dashboard/coach/sessions');
});

test('Core family navigation excludes confirmed unavailable legacy paths and anchors', () => {
  expect(getNavigationItems(user('PARENT', 'CORE_V2')).map(item => item.href)).not.toContain('/dashboard/parent/abonnements');
  const links = getNavigationItems(user('ELEVE', 'CORE_V2')).map(item => item.href);
  expect(links.some(href => href.includes('#'))).toBe(false);
  expect(links).not.toContain('/dashboard/eleve/documents');
  expect(links).toContain('/dashboard/eleve/diagnostics-libres');
});
