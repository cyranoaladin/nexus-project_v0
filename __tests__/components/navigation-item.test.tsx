import { render, screen } from '@testing-library/react';
import { NavigationItem } from '@/components/navigation/NavigationItem';
import { Home } from 'lucide-react';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('NavigationItem', () => {
  it('marks item active on exact match', () => {
    usePathnameMock.mockReturnValue('/dashboard/parent');
    render(
      <NavigationItem
        item={{ label: 'Dashboard', href: '/dashboard/parent', icon: Home, match: 'exact' }}
      />
    );

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks item active on prefix match', () => {
    usePathnameMock.mockReturnValue('/dashboard/parent/paiement/wise');
    render(
      <NavigationItem
        item={{ label: 'Paiements', href: '/dashboard/parent/paiement', icon: Home, match: 'prefix' }}
      />
    );

    const link = screen.getByRole('link', { name: /paiements/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark item active when not matching', () => {
    usePathnameMock.mockReturnValue('/dashboard/parent');
    render(
      <NavigationItem
        item={{ label: 'Paiements', href: '/dashboard/parent/paiement', icon: Home, match: 'prefix' }}
      />
    );

    const link = screen.getByRole('link', { name: /paiements/i });
    expect(link).not.toHaveAttribute('aria-current');
  });
});
