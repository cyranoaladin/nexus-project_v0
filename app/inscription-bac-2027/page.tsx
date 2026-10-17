import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { campagneOuverte, getPagesInscription2027 } from '@/lib/inscription-2027';
import { LEGAL } from '@/lib/legal';
import { buildPageMetadata } from '@/lib/seo';

/** Régénérée toutes les heures : la campagne se referme d'elle-même à la clôture. */
export const revalidate = 3600;

const TITRE = 'Inscription au bac 2027 en candidat individuel — Tunisie';
const DESCRIPTION =
  'Les deux dossiers d’inscription à la session 2027 du baccalauréat français en Tunisie, '
  + 'pour les candidats individuels : bac général et bac STMG.';

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  ...buildPageMetadata({ title: TITRE, description: DESCRIPTION, path: '/inscription-bac-2027' }),
};

const NBSP = ' ';

export default function InscriptionBac2027Page() {
  const maintenant = new Date();
  const pages = getPagesInscription2027();

  /**
   * Donnees structurees : la collection des deux dossiers et le fil d'Ariane.
   * Les dossiers eux-memes portent leur propre Article et leur FAQ, deposes
   * par le generateur. Ici, rien n'est saisi : tout vient du manifeste.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${LEGAL.web.url}/inscription-bac-2027#page`,
        name: TITRE,
        description: DESCRIPTION,
        inLanguage: 'fr',
        isPartOf: { '@id': `${LEGAL.web.url}/#site` },
        publisher: { '@id': `${LEGAL.web.url}/#organisation` },
        hasPart: pages.map((page) => ({
          '@type': 'Article',
          '@id': `${LEGAL.web.url}${page.chemin}#article`,
          headline: page.titre,
          description: page.description,
          url: `${LEGAL.web.url}${page.chemin}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${LEGAL.web.url}/inscription-bac-2027#fil`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${LEGAL.web.url}/` },
          { '@type': 'ListItem', position: 2, name: 'Inscription au bac 2027', item: `${LEGAL.web.url}/inscription-bac-2027` },
        ],
      },
    ],
  };

  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <CorporateNavbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="lux-eyebrow">Candidats individuels · session 2027</p>
          <h1 className="mt-2 font-fraunces text-3xl text-lux-ink md:text-4xl">
            S’inscrire au baccalauréat français en Tunisie
          </h1>
          <div className="lux-filet-gold mt-3 w-16" />
          <p className="mt-4 max-w-2xl text-base leading-7 text-lux-slate">
            Deux dossiers, un par série. Chacun reprend la campagne Cyclades écran par écran,
            les pièces à fournir, les choix d’épreuves et les pièges à éviter.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {pages.map((page) => (
              <article
                key={page.slug}
                aria-labelledby={`dossier-${page.slug}`}
                className="flex flex-col rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow"
              >
                <h2 id={`dossier-${page.slug}`} className="font-fraunces text-xl text-lux-ink">
                  {page.slug === 'general' ? 'Baccalauréat général' : 'Baccalauréat STMG'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-lux-slate">{page.description}</p>
                {campagneOuverte(page, maintenant) ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-lux-gold-deep">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Inscriptions ouvertes
                  </p>
                ) : (
                  <p className="mt-4 text-sm font-semibold text-lux-slate">Inscriptions closes</p>
                )}
                <a
                  href={page.chemin}
                  className="lux-cta-primary mt-auto inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-3 pt-3 text-sm font-semibold"
                >
                  Ouvrir le dossier
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>

          <p className="mt-8 text-sm leading-6 text-lux-slate">
            Ces dossiers sont une synthèse éditoriale de Nexus Réussite. En cas de contradiction
            avec la notice officielle ou avec votre convocation, le document officiel prévaut.{NBSP}
            <Link href="/bac-candidat-libre" className="font-semibold text-lux-gold-deep hover:text-lux-ink">
              Voir aussi notre préparation au bac en candidat individuel
            </Link>
            .
          </p>
        </div>
      </section>
      <CorporateFooter />
    </main>
  );
}
