import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { navigationConfig } from './navigation-config';
import { MobileMenuWrapper } from './MobileMenuWrapper';

export async function Navbar() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const navigationItems = navigationConfig[session.user.role];

  return (
    <header className="sticky top-0 z-50 h-16 bg-surface-card border-b border-neutral-800 lg:pl-[280px]" role="banner">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <MobileMenuWrapper items={navigationItems} user={session.user} />

          <h1 className="text-lg font-bold text-brand-primary lg:hidden">
            Nexus Réussite
          </h1>
        </div>

        <nav className="hidden lg:flex items-center gap-4" aria-label="Actions utilisateur">
          <div className="text-sm text-neutral-400">
            Utilisateur connecté
          </div>
        </nav>
      </div>
    </header>
  );
}
