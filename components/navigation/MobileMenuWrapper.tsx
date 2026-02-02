"use client";

import type { Session } from 'next-auth';
import { MobileMenuProvider, MobileMenu } from './MobileMenu';
import { MobileMenuToggle } from './MobileMenuToggle';
import type { NavigationItem } from './navigation-config';

interface MobileMenuWrapperProps {
  items: NavigationItem[];
  user: Session['user'];
}

export function MobileMenuWrapper({ items, user }: MobileMenuWrapperProps) {
  return (
    <MobileMenuProvider>
      <MobileMenuToggle />
      <MobileMenu items={items} user={user} />
    </MobileMenuProvider>
  );
}
