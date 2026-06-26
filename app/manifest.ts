import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus Réussite',
    short_name: 'Nexus',
    description: 'Accompagnement académique premium pour les élèves du système français à Tunis.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#071A3A',
    background_color: '#071A3A',
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
