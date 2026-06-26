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
