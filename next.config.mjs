/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activer l'output standalone pour la compatibilité avec Docker
  output: 'standalone',

  // Ne pas bloquer le build sur les erreurs ESLint (on traitera via `npm run lint` séparé)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // [SOLUTION] Configuration expérimentale pour forcer l'inclusion des fichiers Prisma
  experimental: {
    // Cette option est cruciale. Elle demande à Next.js de copier les fichiers
    // nécessaires du client Prisma dans le build standalone.
    serverComponentsExternalPackages: ['@prisma/client'],
    webpackBuildWorker: false,
  },

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
