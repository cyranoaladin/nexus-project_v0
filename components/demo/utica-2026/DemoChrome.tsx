'use client';

/**
 * Navigation commune du démonstrateur UTICA 2026 (brief §33, P2 §7-§10) :
 * mode kiosque — navigation contenue dans /demo/utica-2026 (aucun lien
 * externe, vérifié), retour accueil toujours visible, reset manuel
 * toujours accessible, reset automatique après inactivité, navigation
 * mobile utilisable à 390 px sans refonte du desktop.
 *
 * Reset (manuel ou automatique) = rechargement complet vers /demo/utica-2026
 * (`window.location.href`, pas un `router.push`) : garantit une remise à
 * zéro totale de tout état local React, sans dépendre d'aucune API ni
 * écrire quoi que ce soit (le démonstrateur n'utilise déjà aucun
 * localStorage/sessionStorage — vérifié).
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, GraduationCap, Home, Menu, RotateCcw, Sparkles, Telescope, X } from 'lucide-react';
import { DemoBadge } from './DemoBadge';
import { useIdleReset } from '@/lib/demo/utica-2026/useIdleReset';

const DEMO_HOME = '/demo/utica-2026';

const NAV_ITEMS = [
  { href: DEMO_HOME, label: 'Accueil', icon: Home, exact: true },
  { href: '/demo/utica-2026/parent', label: 'Parent', icon: Compass, exact: false },
  { href: '/demo/utica-2026/eleve', label: 'Élève', icon: GraduationCap, exact: false },
  { href: '/demo/utica-2026/aria', label: 'ARIA', icon: Sparkles, exact: false },
  { href: '/demo/utica-2026/360', label: 'Vue 360°', icon: Telescope, exact: false },
];

function resetDemo() {
  window.location.href = DEMO_HOME;
}

export function DemoChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useIdleReset(resetDemo);

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-surface-darker/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={DEMO_HOME} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-100">
            <span className="shrink-0 text-brand-accent">Nexus Réussite</span>
            <span className="hidden truncate text-neutral-500 sm:inline">— Démonstrateur UTICA 2026</span>
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Navigation du démonstrateur">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-primary/20 text-brand-accent'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={resetDemo}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Recommencer
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <DemoBadge className="hidden lg:inline-flex" />
            {/* Bouton menu mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-controls="demo-mobile-menu"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-300 sm:hidden"
            >
              {mobileMenuOpen ? <X className="h-4.5 w-4.5" aria-hidden="true" /> : <Menu className="h-4.5 w-4.5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Panneau de navigation mobile */}
        {mobileMenuOpen && (
          <nav
            id="demo-mobile-menu"
            aria-label="Navigation du démonstrateur (mobile)"
            className="border-t border-white/10 bg-surface-darker px-4 py-3 sm:hidden"
          >
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive ? 'bg-brand-primary/20 text-brand-accent' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={resetDemo}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-neutral-300 hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Recommencer la démonstration
            </button>
            <DemoBadge className="mt-3 inline-flex" />
          </nav>
        )}
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
