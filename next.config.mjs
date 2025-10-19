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
  },

  transpilePackages: ['framer-motion'],

  // Configuration images: optimisation activée avec whitelist de domaines
  images: {
    domains: ['localhost', 'nexusreussite.academy', 'app.nexus-reussite.tn'],
  },
};

export default nextConfig;
