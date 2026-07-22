import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(join(root, path), 'utf8')) as T;

describe('Pré-rentrée 2026 omnichannel communication contract', () => {
  it('provides twenty-four WhatsApp scripts and seven routing keywords', () => {
    const path = 'content/pre-rentree-2026/whatsapp.fr.json';
    expect(existsSync(join(root, path))).toBe(true);
    const source = readJson<{
      keywords: string[];
      scripts: Array<{ id: string; text: string; publicGate: string | null }>;
    }>(path);
    expect(source.keywords).toEqual([
      'PROGRAMME', '3E', 'SECONDE', 'PREMIERE', 'TERMINALE', 'FONDATIONS', 'PREMIUM',
    ]);
    expect(source.scripts).toHaveLength(24);
    expect(new Set(source.scripts.map((script) => script.id)).size).toBe(24);
    expect(source.scripts.every((script) => script.text.length >= 40)).toBe(true);
  });

  it('provides posts, eight carousels, stories and three short Reels with gates', () => {
    const path = 'content/pre-rentree-2026/communication.fr.json';
    expect(existsSync(join(root, path))).toBe(true);
    const source = readJson<{
      publications: Array<{ id: string; publicGate: string | null }>;
      carousels: Array<{ id: string; slides: Array<{ title: string; body: string }> }>;
      stories: Array<{ id: string }>;
      reels: Array<{ id: string; durationSeconds: number; captionsRequired: boolean }>;
    }>(path);
    expect(source.publications.length).toBeGreaterThanOrEqual(13);
    expect(source.carousels).toHaveLength(8);
    expect(source.carousels.every((carousel) => carousel.slides.length >= 4)).toBe(true);
    expect(source.stories.length).toBeGreaterThanOrEqual(12);
    expect(source.reels).toHaveLength(3);
    expect(source.reels.every((reel) => (
      reel.durationSeconds >= 20 && reel.durationSeconds <= 35 && reel.captionsRequired
    ))).toBe(true);
    expect(source.publications.find((item) => item.id === 'manuels')?.publicGate).toBe('MANUALS_READY');
    expect(source.publications.find((item) => item.id === 'derniere-place')?.publicGate).toBe('LIVE_AVAILABILITY');
  });
});
