import type { Metadata } from 'next';

import { EspaceNav, type NavItem } from '@/components/espace/shared/EspaceNav';
import { EspaceProvider } from '@/components/espace/shared/EspaceProvider';
import { getEspaceActor } from '@/lib/espace/guards';
import { getOrganizationTimezone } from '@/lib/timezone';

export const metadata: Metadata = {
  title: { default: 'Espace pédagogique', template: '%s · Espace Nexus' },
  robots: { index: false, follow: false },
};

// L'identité vient de la session à chaque requête : jamais mise en cache entre deux utilisateurs.
export const dynamic = 'force-dynamic';

const STUDENT_NAV: NavItem[] = [
  { href: '/espace/eleve', label: 'Accueil' },
  { href: '/espace/eleve/matieres', label: 'Mes matières' },
  { href: '/espace/eleve/travaux', label: 'Mes travaux' },
  { href: '/espace/eleve/compte', label: 'Mon compte' },
];

const TEACHER_NAV: NavItem[] = [
  { href: '/espace/enseignant', label: 'Accueil' },
  { href: '/espace/enseignant/eleves', label: 'Élèves' },
  { href: '/espace/enseignant/seances', label: 'Séances' },
  { href: '/espace/enseignant/a-corriger', label: 'À corriger' },
  { href: '/espace/enseignant/ressources', label: 'Ressources' },
  { href: '/espace/enseignant/compte', label: 'Mon compte' },
];

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const actor = await getEspaceActor();
  const timezone = getOrganizationTimezone();
  const displayName = actor ? [actor.firstName, actor.lastName].filter(Boolean).join(' ') || 'Mon compte' : '';

  return (
    <EspaceProvider timezone={timezone}>
      <div className="min-h-screen bg-surface-darker text-neutral-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-neutral-900"
        >
          Aller au contenu
        </a>
        {actor && (
          <EspaceNav
            items={actor.role === 'ELEVE' ? STUDENT_NAV : TEACHER_NAV}
            displayName={displayName}
            roleLabel={actor.role === 'ELEVE' ? 'Élève' : 'Enseignant'}
          />
        )}
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </div>
    </EspaceProvider>
  );
}
