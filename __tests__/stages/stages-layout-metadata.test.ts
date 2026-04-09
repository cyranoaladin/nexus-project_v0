import { metadata } from '@/app/stages/layout';

describe('Stages layout metadata', () => {
  it('exports spring 2026 SEO metadata for the active /stages route', () => {
    expect(metadata.title).toBe('Stages Printemps 2026 — La Dernière Ligne Droite | Nexus Réussite');
    expect(metadata.description).toContain('Stages intensifs Première & Terminale');
    expect(metadata.openGraph?.title).toBe('Stages Printemps 2026 — Nexus Réussite');
  });
});
