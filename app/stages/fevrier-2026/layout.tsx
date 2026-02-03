import { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Stages Février 2026 - Le Boost Décisif (Maths & NSI) | Nexus Réussite',
  description: 'Stages intensifs février 2026 en Maths et NSI. Deux paliers (Prépa Bac / Excellence). Maîtrise, progression mesurée, trajectoire. 6 élèves max. Enseignants agrégés. Centre Urbain Nord, Tunis.',
  keywords: [
    'stage février 2026',
    'stage maths terminale',
    'stage NSI terminale',
    'préparation bac tunisie',
    'cours intensifs février',
    'stage première maths',
    'stage première NSI',
    'parcoursup préparation',
    'mention bac',
    'excellence académique'
  ],
  openGraph: {
    title: 'Stages Février 2026 - Le Boost Décisif (Maths & NSI)',
    description: 'Maîtrise, progression mesurée, trajectoire. Deux paliers adaptés à chaque profil. 6 élèves max, enseignants agrégés.',
    type: 'website',
    locale: 'fr_TN',
    url: 'https://nexusreussite.tn/stages/fevrier-2026',
    siteName: 'Nexus Réussite',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stages Février 2026 - Nexus Réussite',
    description: 'Stages intensifs Maths & NSI. Maîtrise, progression, trajectoire.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function StagesFevrier2026Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      
      {/* JSON-LD Schemas */}
      <Script
        id="schema-event"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: 'Stages Février 2026 - Maths & NSI',
            description: 'Stages intensifs février 2026 en Mathématiques et NSI. Deux paliers : Prépa Bac (consolider) et Excellence (approfondir). Groupes de 6 élèves maximum.',
            startDate: '2026-02-16',
            endDate: '2026-02-26',
            eventStatus: 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: {
              '@type': 'Place',
              name: 'Nexus Réussite',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Centre Urbain Nord',
                addressLocality: 'Tunis',
                addressCountry: 'TN',
              },
            },
            offers: [
              {
                '@type': 'Offer',
                name: 'Pallier 1 - Prépa Bac (Première)',
                price: '417',
                priceCurrency: 'TND',
                availability: 'https://schema.org/InStock',
                validFrom: '2026-01-15',
              },
              {
                '@type': 'Offer',
                name: 'Pallier 1 - Prépa Bac (Terminale)',
                price: '502',
                priceCurrency: 'TND',
                availability: 'https://schema.org/InStock',
                validFrom: '2026-01-15',
              },
              {
                '@type': 'Offer',
                name: 'Pallier 2 - Excellence',
                price: '842',
                priceCurrency: 'TND',
                availability: 'https://schema.org/LimitedAvailability',
                validFrom: '2026-01-15',
              },
            ],
            organizer: {
              '@type': 'Organization',
              name: 'Nexus Réussite',
              url: 'https://nexusreussite.tn',
            },
          }),
        }}
      />

      <Script
        id="schema-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Nexus Réussite',
            url: 'https://nexusreussite.tn',
            logo: 'https://nexusreussite.tn/logo.png',
            description: 'Académie premium spécialisée en Mathématiques et NSI. Excellence, maîtrise, trajectoire.',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Centre Urbain Nord',
              addressLocality: 'Tunis',
              addressCountry: 'TN',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.9',
              ratingCount: '150',
            },
          }),
        }}
      />

      <Script
        id="schema-faqpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'À qui s'adressent ces stages ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Aux élèves de Première et Terminale (système français, tunisien, candidats libres) qui souhaitent consolider leurs acquis, combler des lacunes ou viser une mention. Deux paliers : Prépa Bac pour sécuriser, Excellence pour approfondir.',
                },
              },
              {
                '@type': 'Question',
                name: 'Pourquoi proposer un stage en février ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Février est un moment clé : c'est là que se jouent la dynamique de fin d'année, la confiance et la maîtrise avant la dernière ligne droite des dossiers d'admission et du Bac.',
                },
              },
              {
                '@type': 'Question',
                name: 'Les stages garantissent-ils des résultats ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Les résultats dépendent du travail personnel et de l'implication de chacun. Nous observons en moyenne une progression de 4,2 points, mais chaque trajectoire est unique. Notre engagement : cadre structuré, méthode rigoureuse, bilan individualisé.',
                },
              },
              {
                '@type': 'Question',
                name: 'Qui encadre les stages ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Enseignants experts : professeurs agrégés et certifiés, avec expérience du Bac. Pédagogie différenciée, bilans individualisés, suivi personnalisé.',
                },
              },
              {
                '@type': 'Question',
                name: 'Épreuve pratique & Grand Oral : quand les travailler ?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'L'épreuve pratique (NSI) et le Grand Oral ne sont pas au centre du stage de février. Ils seront travaillés spécifiquement lors des vacances de printemps via un pack dédié. Février = fondamentaux + méthode + confiance.',
                },
              },
            ],
          }),
        }}
      />
    </>
  );
}
