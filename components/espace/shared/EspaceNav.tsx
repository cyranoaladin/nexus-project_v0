'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
}

/** Navigation volontairement courte ; l'élément actif est annoncé (aria-current), pas seulement coloré. */
export function EspaceNav({ items, displayName, roleLabel }: { items: NavItem[]; displayName: string; roleLabel: string }) {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) => (href.split('/').length <= 3 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="border-b border-white/10 bg-surface-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav aria-label="Navigation de l’espace" className="flex flex-wrap items-center gap-1">
          <span className="mr-3 font-semibold text-neutral-100">Espace Nexus</span>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
                isActive(item.href) ? 'bg-white/10 font-medium text-neutral-50' : 'text-neutral-300 hover:bg-white/5 hover:text-neutral-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-300">
            {displayName} <span className="text-neutral-400">· {roleLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/espace/connexion' })}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  );
}
