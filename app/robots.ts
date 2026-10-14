import { MetadataRoute } from 'next';

/** Espaces privés : jamais explorés, quel que soit le robot. */
const ESPACES_PRIVES = ['/dashboard/', '/api/', '/auth/', '/espace/', '/session/', '/test/', '/demo/'];

/**
 * Robots des moteurs de réponse et assistants génératifs, autorisés explicitement
 * pour que Nexus Réussite puisse être cité (ChatGPT, Claude, Gemini, Perplexity, Apple).
 * Ils reçoivent en plus /llms.txt et /llms-full.txt, la fiche factuelle du site.
 */
const ROBOTS_IA = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';

  return {
    rules: [
      { userAgent: '*', allow: ['/'], disallow: ESPACES_PRIVES },
      { userAgent: ROBOTS_IA, allow: ['/', '/llms.txt', '/llms-full.txt'], disallow: ESPACES_PRIVES },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
