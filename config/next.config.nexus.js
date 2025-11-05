/** Bloc de rewrite à intégrer dans next.config.mjs pour le proxy FastAPI. */
export const nexusRewrites = [
  { source: '/pyapi/:path*', destination: 'http://localhost:8000/:path*' },
];
