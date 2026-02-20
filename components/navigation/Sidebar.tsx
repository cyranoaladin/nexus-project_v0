import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { navigationConfig } from './navigation-config';
import { NavigationItem } from './NavigationItem';
import UserProfile from './UserProfile';
import { LogoutButton } from './LogoutButton';

export async function Sidebar() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const navigationItems = navigationConfig[session.user.role];

  return (
    <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 w-[280px] bg-surface-card border-r border-neutral-800 flex-col z-50">
      <div className="flex flex-col h-full">
        <div className="flex items-center h-16 px-6 border-b border-neutral-800">
          <h1 className="text-xl font-bold text-brand-primary">
            Nexus Réussite
          </h1>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto py-6">
          <UserProfile user={session.user} />

          <nav className="flex-1 px-4" aria-label="Navigation principale">
            <ul className="space-y-1">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <NavigationItem item={item} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-neutral-800 p-4">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
