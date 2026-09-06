import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@/types/enums';
it('keeps payments, invoicing and bilans without credit navigation', () => {
  const links = navigationConfig[UserRole.ASSISTANTE];
  expect(links.some(item => /crédit|\/credits|credit-requests/i.test(item.label + item.href))).toBe(false);
  for (const path of ['paiements', 'facturation', 'bilans']) {
    expect(links.some(item => item.href === `/dashboard/assistante/${path}`)).toBe(true);
  }
});
