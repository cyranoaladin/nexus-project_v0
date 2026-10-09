import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { Navbar } from '@/components/navigation/Navbar';

jest.mock('@/lib/nsi-pratique-2026/access', () => ({
  filterNsiPratiqueNavigation: jest.fn(async () => []),
}));
jest.mock('@/components/navigation/MobileMenuWrapper', () => ({ MobileMenuWrapper: () => null }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, prefetch, children }: PropsWithChildren<{ href: string; prefetch?: boolean }>) => (
    <a href={href} data-speculative-fetch={String(prefetch !== false)}>{children}</a>
  ),
}));

test.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const)(
  '%s can navigate to account security without speculative credential-page loading', async (role) => {
    render(await Navbar({ user: { id: 'synthetic-account', role, email: 'account@example.test',
      firstName: 'Synthetic', lastName: 'Account' } }));
    const link = screen.getByRole('link', { name: 'Sécurité du compte' });
    expect(link).toHaveAttribute('href', '/dashboard/account/security');
    expect(link).toHaveAttribute('data-speculative-fetch', 'false');
  },
);
