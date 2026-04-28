import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@/types/enums';

describe('assistante navigation', () => {
  it('exposes the facturation page only in the assistante navigation', () => {
    expect(navigationConfig[UserRole.ASSISTANTE]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Facturation',
          href: '/dashboard/assistante/facturation',
        }),
      ])
    );

    expect(navigationConfig[UserRole.ELEVE]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/dashboard/assistante/facturation' }),
      ])
    );
    expect(navigationConfig[UserRole.COACH]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/dashboard/assistante/facturation' }),
      ])
    );
  });
});
