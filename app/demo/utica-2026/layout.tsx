/**
 * Layout racine du démonstrateur UTICA 2026.
 *
 * - Kill switch (amendement A2) : notFound() si UTICA_DEMO_ENABLED n'est pas
 *   explicitement "true" — aucune page /demo/utica-2026/** n'est consultable
 *   par défaut, et aucun bypass du middleware/auth existant n'est requis
 *   (cf. amendement A1 : /demo n'est pas un chemin protégé).
 * - Noindex (amendement A1) : `robots` porté ici plutôt que dans
 *   middleware.ts ; voir aussi app/robots.ts pour le Disallow.
 * - `dynamic = 'force-dynamic'` : sans ça, Next.js prérendrait ces routes en
 *   statique AU BUILD, figeant la valeur de UTICA_DEMO_ENABLED lue à ce
 *   moment-là dans le HTML généré — le kill switch deviendrait alors inerte
 *   après coup (impossible de l'activer/désactiver sans reconstruire). Le
 *   flag doit être relu à chaque requête.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUticaDemoEnabled } from '@/lib/demo/utica-2026/flag';
import { DemoChrome } from '@/components/demo/utica-2026/DemoChrome';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Démonstrateur UTICA 2026 | Nexus Réussite',
  description: 'Démonstration à données fictives du parcours candidat individuel Nexus Réussite.',
  robots: { index: false, follow: false, nocache: true },
};

export default function UticaDemoLayout({ children }: { children: React.ReactNode }) {
  if (!isUticaDemoEnabled()) {
    notFound();
  }

  return <DemoChrome>{children}</DemoChrome>;
}
