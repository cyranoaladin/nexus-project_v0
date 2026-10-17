/**
 * SEO constants and helpers — single source of truth for metadata shared across pages.
 */

/** Default OG image used by all pages (1200×630, lux-ink bg + logo). */
export const OG_DEFAULT_IMAGE = {
  url: '/og-default.png',
  width: 1200,
  height: 630,
  alt: 'Nexus Réussite — Accompagnement académique premium à Tunis',
} as const;

/**
 * Build a complete openGraph object from title + description + path.
 * Includes OG_DEFAULT_IMAGE, siteName, locale, type — consistent with root layout.
 * The path is also used for alternates.canonical (resolved against metadataBase).
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    openGraph: {
      images: [OG_DEFAULT_IMAGE],
      title,
      description,
      siteName: 'Nexus Réussite',
      locale: 'fr_FR',
      type: 'website' as const,
      url: path,
    },
    alternates: {
      canonical: path,
    },
  };
}

/**
 * Sérialise un bloc de données structurées pour un `<script type="…ld+json">`.
 *
 * Le chevron est échappé en `\u003c` : sans cela, un « </script> » présent
 * dans une réponse de FAQ fermerait la balise et casserait la page, bien
 * avant que le JSON soit jugé valide ou non. L'échappement est transparent
 * pour les analyseurs : `JSON.parse` rend exactement la chaîne d'origine.
 */
export function serialiserJsonLd(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, '\\u003c');
}

/** Fil d'Ariane : l'accueil, puis la page. Affiché par les moteurs sous le titre. */
export function filArianeJsonLd(chemin: string, nom: string) {
  const base = 'https://nexusreussite.academy';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: nom, item: `${base}${chemin}` },
    ],
  };
}
