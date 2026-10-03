import type { Session } from 'next-auth';
import Link from 'next/link';
import { navigationConfig } from './navigation-config';
import { MobileMenuWrapper } from './MobileMenuWrapper';
import { filterNsiPratiqueNavigation } from '@/lib/nsi-pratique-2026/access';

export async function Navbar({ user }: { user: Session['user'] }) {
  const navigationItems = await filterNsiPratiqueNavigation(
    navigationConfig[user.role],
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
  );

  return (
    <header className="sticky top-0 z-50 h-16 bg-surface-card border-b border-neutral-800 lg:pl-[280px]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <MobileMenuWrapper items={navigationItems} user={user} />

          <span className="text-lg font-bold text-brand-accent lg:hidden">
            Nexus Réussite
          </span>
        </div>

        <nav className="flex items-center gap-4" aria-label="Actions utilisateur">
          <Link href="/dashboard/account/security" prefetch={false} className="text-sm underline focus-visible:outline focus-visible:outline-2">Sécurité du compte</Link>
          <div className="hidden lg:block text-sm text-neutral-300">
            Utilisateur connecté
          </div>
        </nav>
      </div>
    </header>
  );
}
