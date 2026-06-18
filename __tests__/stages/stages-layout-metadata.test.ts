import { metadata } from '@/app/stages/layout';

describe('Stages layout metadata', () => {
  it('exports the 2026/2027 SEO metadata for the active /stages route', () => {
    expect(metadata.title).toBe('Stages 2026/2027 | Nexus Réussite');
    expect(metadata.description).toContain('Stages de prérentrée, Toussaint, hiver, printemps et sprint final');
    expect(metadata.openGraph?.title).toBe('Stages 2026/2027 — Nexus Réussite');
  });
});
