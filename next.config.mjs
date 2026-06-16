/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for production builds
  output: 'standalone',

  // Fix workspace root warning from multiple lockfiles
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    '/': [
      './Nexus_Reussite_Accueil.html',
      './data/offres-nexus.json',
      './src/static-pages/assistante-devis-v3/**/*',
    ],
  },

  // Ne pas bloquer le build sur les erreurs ESLint (on traitera via `npm run lint` séparé)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // [SOLUTION] Moved from experimental to top-level in Next.js 15
  // Keep native deps + logging stack external to avoid worker.js/worker thread warnings.
  serverExternalPackages: [
    '@prisma/client',
    'pino',
    'pino-pretty',
    'thread-stream',
    'pino-abstract-transport',
    'pdfkit',
  ],



  transpilePackages: ['framer-motion'],

  // Configuration pour les images - DÉSACTIVATION COMPLÈTE pour éviter erreurs 400
  images: {
    unoptimized: true, // Désactiver l'optimisation d'images Next.js
  },

  // Prevent ChunkLoadError after deploys: HTML pages must never be served from cache
  // (static chunks are fine — they have content-hash filenames)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // But static hashed chunks CAN be cached long-term
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirections pour restructuration navigation
  async redirects() {
    return [
      {
        source: '/academies-hiver',
        destination: '/stages',
        permanent: true, // 301 redirect (permanent)
      },
      {
        source: '/plateforme',
        destination: '/plateforme-aria',
        permanent: true, // 301 redirect (permanent)
      },
      {
        source: '/education',
        destination: '/accompagnement-scolaire',
        permanent: true, // 301 redirect (consolidation)
      },
      {
        source: '/inscription',
        destination: '/bilan-gratuit',
        permanent: false, // 307 — UX redirect for parents
      },
      {
        source: '/questionnaire',
        destination: '/bilan-gratuit',
        permanent: false, // 307 — questionnaire is part of bilan-gratuit
      },
      {
        source: '/tarifs',
        destination: '/offres',
        permanent: false, // 307 — pricing page alias
      },
    ];
  },
};

export default nextConfig;
