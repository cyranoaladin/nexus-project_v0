/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activer l'output standalone pour la compatibilité avec Docker
  output: 'standalone',

  // Fix workspace root warning from multiple lockfiles
  outputFileTracingRoot: process.cwd(),

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
  ],



  transpilePackages: ['framer-motion'],

  // Configuration pour les images - DÉSACTIVATION COMPLÈTE pour éviter erreurs 400
  images: {
    unoptimized: true, // Désactiver l'optimisation d'images Next.js
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
    ];
  },
};

export default nextConfig;
