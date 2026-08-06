"use client";

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';

export function LogoutButton() {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <Button
      variant="ghost"
      onClick={() => void handleSignOut()}
      data-testid="logout-button"
      className="w-full justify-start gap-3 text-neutral-300 hover:text-neutral-50"
      aria-label="Se déconnecter de votre compte"
    >
      <LogOut className="h-5 w-5" aria-hidden="true" />
      <span>Déconnexion</span>
    </Button>
  );
}
