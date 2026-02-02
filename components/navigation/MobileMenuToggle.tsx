"use client";

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileMenu } from './MobileMenu';

export function MobileMenuToggle() {
  const { isOpen, toggle } = useMobileMenu();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={toggle}
      aria-label="Ouvrir le menu"
      aria-expanded={isOpen}
    >
      <Menu className="h-6 w-6" />
    </Button>
  );
}
