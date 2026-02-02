import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export async function Navbar() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <header className="sticky top-0 z-50 h-16 bg-surface-card border-b border-neutral-800 lg:pl-72">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <h1 className="text-lg font-bold text-brand-primary lg:hidden">
            YKS Platform
          </h1>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <div className="text-sm text-neutral-400">
            Utilisateur connecté
          </div>
        </div>
      </div>
    </header>
  );
}
