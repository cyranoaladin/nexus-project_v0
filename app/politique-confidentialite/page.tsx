import type { Metadata } from 'next';
import Link from 'next/link';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { LEGAL } from '@/lib/legal';
import { buildPageMetadata } from '@/lib/seo';

const _title = 'Politique de confidentialité | Nexus Réussite';
const _desc = 'Traitement des données de contact, bilan gratuit et newsletter Nexus Réussite.';

export const metadata: Metadata = {
  title: _title,
  description: _desc,
  robots: { index: true, follow: true },
  ...buildPageMetadata({ title: _title, description: _desc, path: '/politique-confidentialite' }),
};

export default function PolitiqueConfidentialitePage() {
  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <CorporateNavbar />
      <section className="px-4 pb-16 pt-32 md:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow md:p-10">
          <p className="lux-eyebrow">Données personnelles</p>
          <h1 className="mt-3 text-3xl font-fraunces text-lux-ink md:text-4xl">
            Politique de confidentialité
          </h1>
          <div className="mt-6 space-y-5 text-sm leading-7 text-lux-slate">
            <p>
              Les informations transmises via les formulaires Nexus Réussite servent uniquement à traiter une demande
              de contact, de bilan gratuit, de rappel ou d’inscription à la newsletter.
            </p>
            <p>
              Les données collectées sont limitées aux informations nécessaires à l’échange pédagogique : identité du
              parent ou demandeur, coordonnées, niveau de l’élève, besoin exprimé et message libre.
            </p>
            <p>
              Nexus Réussite ne publie pas ces données et ne les utilise pas pour afficher des témoignages, avis ou
              chiffres de preuve sociale sans consentement explicite.
            </p>
            {/* Mentions validées par le juriste — texte VERBATIM, ne pas reformuler. */}
            <h2 className="pt-2 text-lg font-fraunces text-lux-ink">Transmission des bilans</h2>
            <p>
              Avec votre accord, le bilan de votre enfant peut vous être transmis par WhatsApp, au numéro que vous
              nous avez communiqué. Vous recevez alors un lien personnel, valable trente jours, que nous pouvons
              révoquer à tout moment. Les consultations de ce lien sont enregistrées à la date seule. Le document
              interne destiné à nos enseignants ne vous est jamais transmis par ce canal.
            </p>
            <h2 className="pt-2 text-lg font-fraunces text-lux-ink">Production des bilans</h2>
            <p>
              Comment ce bilan est produit. Le diagnostic repose sur un barème déterministe : les scores et les
              profils sont calculés par notre moteur d’analyse, sans intervention d’un système génératif. Les
              questions du test ont été rédigées et validées par nos enseignants de la discipline. Pour la partie
              rédactionnelle destinée à nos enseignants, nous nous appuyons sur un outil d’aide à la rédaction ;
              aucun contenu n’est transmis sans avoir été relu et validé par un membre de notre équipe pédagogique.
              Les données utilisées sont pseudonymisées : le prénom et le nom de votre enfant ne sont jamais
              transmis à un service externe.
            </p>
            <p>
              Pour toute demande d’accès, de correction ou de suppression, contactez{' '}
              <a className="font-semibold text-lux-gold-deep underline" href={`mailto:${LEGAL.contact.email}`}>
                {LEGAL.contact.email}
              </a>.
            </p>
          </div>
          <Link href="/contact" className="mt-8 inline-flex min-h-[44px] items-center rounded-lg border border-lux-line px-5 py-3 text-sm font-semibold text-lux-ink">
            Retour au contact
          </Link>
        </div>
      </section>
      <CorporateFooter />
    </main>
  );
}
