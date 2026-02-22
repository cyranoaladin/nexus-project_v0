"use client";

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <Button
      variant="ghost"
      onClick={handleSignOut}
      data-testid="logout-button"
      className="w-full justify-start gap-3 text-neutral-400 hover:text-neutral-50"
      aria-label="Se déconnecter de votre compte"
    >
      <LogOut className="h-5 w-5" aria-hidden="true" />
      <span>Déconnexion</span>
    </Button>
  );
}
