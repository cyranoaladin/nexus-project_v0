import type { Metadata } from 'next';

/**
 * Page référencée depuis la mise en production : elle est reliée à l'accueil,
 * présente au sitemap, et annonce elle-même son statut de pré-commande —
 * la disponibilité, le délai et le règlement sont confirmés avec le client
 * avant toute fabrication. Rien n'y est promis qui ne soit tenu.
 */
export const metadata: Metadata = {
  title: 'Manuels pour candidats individuels — Nexus Réussite',
  description:
    'Choisissez vos manuels du baccalauréat général, voyez le prix et la remise de lot, en PDF ou en PDF plus papier. Retrait au centre Nexus ou livraison offerte.',
  alternates: { canonical: '/manuels' },
  robots: { index: true, follow: true },
};

export default function ManuelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
