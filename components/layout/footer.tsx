/**
 * @deprecated LEGACY COMPONENT - DO NOT USE IN NEW CODE
 * 
 * This component is maintained only for auth and dashboard pages that are out of scope
 * for the current design system migration.
 * 
 * For all public pages, use CorporateFooter instead.
 * 
 * Used by (out of scope):
 * - app/auth/signin/page.tsx
 * - app/auth/mot-de-passe-oublie/page.tsx
 * - app/bilan-gratuit/confirmation/page.tsx
 * - app/dashboard/parent/page.tsx
 * - app/dashboard/parent/abonnements/page.tsx
 * - app/dashboard/admin/page.tsx
 */

'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-surface-dark text-neutral-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Nexus Réussite. Tous droits réservés.
          </p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/mentions-legales" className="text-sm hover:text-brand-accent transition-colors">
              Mentions légales
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
