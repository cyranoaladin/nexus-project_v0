import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/auth/',
          '/session/',
          '/test/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
