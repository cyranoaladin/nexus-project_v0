/**
 * @deprecated LEGACY COMPONENT - DO NOT USE IN NEW CODE
 * 
 * This component is maintained only for auth and dashboard pages that are out of scope
 * for the current design system migration.
 * 
 * For all public pages, use CorporateNavbar instead.
 * 
 * Used by (out of scope):
 * - app/auth/signin/page.tsx
 * - app/auth/mot-de-passe-oublie/page.tsx
 * - app/bilan-gratuit/confirmation/page.tsx
 */

'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-primary">
            Nexus Réussite
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-neutral-700 hover:text-brand-primary transition-colors">
              Accueil
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
