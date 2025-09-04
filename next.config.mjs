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

  // --- AJOUT POUR LA COMPATIBILITÉ AVEC LES MODULES NATIFS ---
  webpack: (config, { isServer }) => {
    // Cette configuration est essentielle pour que les bibliothèques d'IA comme
    // `@xenova/transformers` (qui utilise `onnxruntime-node`) fonctionnent côté serveur.

    // On dit à Next.js de ne pas essayer d'empaqueter ce module natif.
    // Il sera chargé directement par Node.js au moment de l'exécution.
    config.externals.push('onnxruntime-node');

    // On ajoute une règle pour que Webpack sache comment gérer les fichiers binaires `.node`.
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
  // --- FIN DE L'AJOUT ---

  // En-têtes de sécurité (appliqués par Next; compléter côté reverse proxy)
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    // Content Security Policy adaptée à notre app
    // NOTE: Ajuster les domaines lors du déploiement (CDN, analytics, etc.)
    // Construire la CSP dynamiquement (dev nécessite 'unsafe-eval' pour React Refresh/HMR)
    let scriptSrc = "script-src 'self' 'unsafe-inline' blob:";
    if (!isProd) {
      scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:";
    }

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      // Images (logo/header/footer, avatars, etc.)
      "img-src 'self' data: blob: https:",
      // Fonts
      "font-src 'self' data:",
      // Styles (autoriser inline pour Tailwind runtime classes)
      "style-src 'self' 'unsafe-inline' https:",
      // Scripts (éviter unsafe-eval en prod; autoriser blob:)
      scriptSrc,
      // Connexions sortantes (API internes + websockets)
      "connect-src 'self' http://localhost:8001 http://localhost:8002 http://localhost:8003 https: ws: wss:",
      // Frames (Jitsi par défaut; adapter selon env)
      "frame-src 'self' https://meet.jit.si",
      // Form actions limitées au site
      "form-action 'self'",
      // Clickjacking protection (en plus de X-Frame-Options)
      "frame-ancestors 'none'",
    ].join('; ');

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
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
