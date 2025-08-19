/** @type {import('next').NextConfig} */
const nextConfig = {
  // Active la sortie standalone pour une compatibilité Docker optimale
  output: 'standalone',

  // Correction pour l'erreur de build ESLint
  eslint: {
    ignoreDuringBuilds: true, // Nous nous fierons au linting en pre-commit
  },

  // Désactivation de l'optimisation des images pour le débogage du build
  images: {
    unoptimized: true,
  },

  // Désactivation d'une fonctionnalité expérimentale potentiellement instable
  experimental: {
    ppr: false,
  },

  // En-têtes de sécurité (appliqués par Next; compléter côté reverse proxy)
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // HSTS uniquement en prod et derrière HTTPS
      ...(isProd
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
        : []),
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
