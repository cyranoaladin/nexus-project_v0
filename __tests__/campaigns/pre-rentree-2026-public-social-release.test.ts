import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const socialRoot = join(root, 'assets/campaigns/pre-rentree-2026/social');

describe('Pré-rentrée 2026 public social release', () => {
  it('separates a watermark-free PUBLIC family from a watermarked REVIEW family', () => {
    const publicManifest = JSON.parse(
      readFileSync(join(socialRoot, 'manifest-public.json'), 'utf8'),
    ) as { purpose: string; publicationStatus: string; assets: Array<{ path: string }> };
    const reviewManifest = JSON.parse(
      readFileSync(join(socialRoot, 'manifest-review.json'), 'utf8'),
    ) as { purpose: string; watermark: string; assets: Array<{ path: string }> };

    expect(publicManifest.purpose).toBe('PUBLIC_RELEASE_CANDIDATE');
    expect(publicManifest.publicationStatus).toBe('PUBLIC_RELEASE_CANDIDATE');
    expect(publicManifest.assets.every((asset) => asset.path.startsWith('PUBLIC/'))).toBe(true);
    expect(reviewManifest.purpose).toBe('INTERNAL_REVIEW');
    expect(reviewManifest.watermark).toBe('DOCUMENT DE REVUE — DIFFUSION INTERDITE');
    expect(reviewManifest.assets.every((asset) => asset.path.startsWith('REVIEW/'))).toBe(true);
  });

  it('delivers the main and four level-specific Feed and Story assets', () => {
    const expected = [
      'PUBLIC/feed/principal.png',
      'PUBLIC/feed/entree-3e.png',
      'PUBLIC/feed/entree-seconde.png',
      'PUBLIC/feed/entree-premiere.png',
      'PUBLIC/feed/entree-terminale.png',
      'PUBLIC/story/principale.png',
      'PUBLIC/story/entree-3e.png',
      'PUBLIC/story/entree-seconde.png',
      'PUBLIC/story/entree-premiere.png',
      'PUBLIC/story/entree-terminale.png',
      'PUBLIC/carrousel/carousel-pre-rentree-2026.pdf',
      'PUBLIC/reel/pre-rentree-2026.mp4',
      'PUBLIC/reel/sous-titres-fr.srt',
      'REVIEW/contact-sheets/feed.png',
      'REVIEW/contact-sheets/story.png',
      'REVIEW/contact-sheets/campagne-sociale.pdf',
    ];

    expect(expected.every((path) => existsSync(join(socialRoot, path)))).toBe(true);
  });

  it('publishes a dated calendar with complete channel, CTA, UTM and WhatsApp data', () => {
    const calendar = JSON.parse(
      readFileSync(join(socialRoot, 'PUBLIC/calendrier/calendrier.json'), 'utf8'),
    ) as Array<Record<string, unknown>>;
    const textualPublicAssets = [
      readFileSync(join(socialRoot, 'PUBLIC/calendrier/calendrier.json'), 'utf8'),
      readFileSync(join(socialRoot, 'PUBLIC/textes/campagne.json'), 'utf8'),
      readFileSync(join(socialRoot, 'PUBLIC/textes/whatsapp.md'), 'utf8'),
    ].join('\n');

    expect(calendar.length).toBeGreaterThan(0);
    expect(calendar.every((item) => (
      /^\d{4}-\d{2}-\d{2}$/.test(item.publicationDate as string)
      && item.publicationTime && item.channel && item.audience && item.assetId
      && item.body && item.cta && item.utm && item.whatsappPrefill
    ))).toBe(true);
    expect(textualPublicAssets).toContain('99 192 829');
    expect(textualPublicAssets).not.toMatch(/date": null|Document de revue|diffusion interdite/i);
    expect(textualPublicAssets).not.toMatch(/Seconde[^.]{0,180}Physique[- ]?Chimie|Physique[- ]?Chimie[^.]{0,180}Seconde/i);
    expect(textualPublicAssets).not.toMatch(/Programme et inscription|Pré-inscrire|\bRéserver\b|\bPayer\b/i);
  });
});
