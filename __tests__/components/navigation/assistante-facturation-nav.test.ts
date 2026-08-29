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

  it('exposes the bilan review queue only in the assistante navigation', () => {
    expect(navigationConfig[UserRole.ASSISTANTE]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Bilans',
          href: '/dashboard/assistante/bilans',
        }),
      ])
    );

    for (const role of [UserRole.ELEVE, UserRole.PARENT, UserRole.COACH]) {
      expect(navigationConfig[role]).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ href: '/dashboard/assistante/bilans' }),
        ])
      );
    }
  });

  it('exposes the internal quote assistant only in the assistante navigation', () => {
    expect(navigationConfig[UserRole.ASSISTANTE]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Assistant devis',
          href: '/dashboard/assistante/devis',
        }),
      ])
    );

    for (const role of [UserRole.ELEVE, UserRole.PARENT, UserRole.COACH]) {
      expect(navigationConfig[role]).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ href: '/dashboard/assistante/devis' }),
        ])
      );
    }
  });

  it('exposes the candidat individuel simulator to assistante and admin roles only', () => {
    const expectedItem = expect.objectContaining({
      label: 'Devis candidat individuel',
      href: '/dashboard/assistante/candidat-individuel',
    });

    expect(navigationConfig[UserRole.ASSISTANTE]).toEqual(expect.arrayContaining([expectedItem]));
    expect(navigationConfig[UserRole.ADMIN]).toEqual(expect.arrayContaining([expectedItem]));

    for (const role of [UserRole.ELEVE, UserRole.PARENT, UserRole.COACH]) {
      expect(navigationConfig[role]).not.toEqual(expect.arrayContaining([expectedItem]));
    }
  });
});
