import 'server-only';

import { getCandidatsLibres2027 } from '@/lib/candidats-libres-2027';
import { LEGAL } from '@/lib/legal';
import { fmtMontant } from '@/components/premium/format';
import { getAllOffers, getEffectivePrice } from '@/lib/pricing';

/**
 * Données structurées globales (schema.org) : l'organisation (siège social),
 * son centre pédagogique (lieu des cours) et le site. Toutes les valeurs viennent
 * de LEGAL et de pricing.canonical.json.
 */
export function buildOrganisationJsonLd() {
  const url = LEGAL.web.url;
  const organisationId = `${url}/#organisation`;
  const centre = LEGAL.addresses.pedagogique;
  const siege = LEGAL.addresses.siege;

  // Offres publiées : annuelles hors anciennes offres candidat libre (retirées du public), plus la grille 2026-2027.
  const prix = [
    ...getAllOffers()
      .filter((offre) => offre.track !== 'libre')
      .map((offre) => getEffectivePrice(offre))
      .filter((valeur): valeur is number => typeof valeur === 'number'),
    ...getCandidatsLibres2027().parcours.map((p) => p.prix_annuel),
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': organisationId,
        name: LEGAL.entity.tradeName,
        legalName: LEGAL.entity.name,
        url,
        logo: `${url}/images/logo_nexus_reussite.png`,
        description:
          'Accompagnement au bac français à Tunis : élèves des lycées français et candidats libres (candidats individuels), groupes réduits, épreuves blanches corrigées, bilans avec la famille et inscription Cyclades accompagnée.',
        email: LEGAL.contact.email,
        telephone: LEGAL.contact.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: siege.full.split(', ').slice(0, -1).join(', '),
          postalCode: siege.postalCode,
          addressLocality: siege.city,
          addressCountry: 'TN',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: LEGAL.contact.phone,
          email: LEGAL.contact.email,
          contactType: 'customer service',
          availableLanguage: ['fr'],
          areaServed: 'TN',
        },
        areaServed: [
          { '@type': 'City', name: 'Tunis' },
          { '@type': 'Country', name: 'Tunisie' },
        ],
        knowsAbout: [
          'Baccalauréat français',
          'Candidat libre au bac français',
          'Épreuves anticipées de français et de mathématiques',
          'Grand oral',
          'Inscription Cyclades',
          'Enseignement de spécialité mathématiques, physique-chimie et NSI',
        ],
        availableLanguage: ['fr'],
        sameAs: LEGAL.web.profils,
        offers:
          prix.length > 0
            ? {
                '@type': 'AggregateOffer',
                priceCurrency: 'TND',
                lowPrice: String(Math.min(...prix)),
                highPrice: String(Math.max(...prix)),
                offerCount: String(prix.length),
              }
            : undefined,
      },
      {
        '@type': ['EducationalOrganization', 'LocalBusiness'],
        '@id': `${url}/#centre-pedagogique`,
        name: `${LEGAL.entity.tradeName} — centre pédagogique ${centre.neighborhood}`,
        url: `${url}/notre-centre`,
        telephone: LEGAL.contact.phone,
        email: LEGAL.contact.email,
        // Une fourchette lisible plutôt que la seule devise : c'est ce que
        // les moteurs affichent, et « TND » seul n'apprend rien à personne.
        priceRange: prix.length > 0
          ? `${fmtMontant(Math.min(...prix))}\u2013${fmtMontant(Math.max(...prix))}\u00a0TND`
          : undefined,
        address: {
          '@type': 'PostalAddress',
          streetAddress: centre.street,
          addressLocality: `${centre.neighborhood}, ${centre.city}`,
          addressCountry: 'TN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: centre.geo.latitude,
          longitude: centre.geo.longitude,
        },
        hasMap: centre.maps,
        sameAs: [centre.maps],
        parentOrganization: { '@id': organisationId },
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#site`,
        url,
        name: LEGAL.entity.tradeName,
        inLanguage: 'fr',
        publisher: { '@id': organisationId },
      },
    ],
  };
}
