import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sourcePath = join(root, 'content/pre-rentree-2026/full-campaign.fr.json');
const contractPath = join(root, 'content/pre-rentree-2026/commercial-contract.fr.json');
const proofsPath = join(root, 'content/pre-rentree-2026/proofs.registry.json');

const requiredFields = [
  'audience',
  'channel',
  'level',
  'funnelStage',
  'objective',
  'hook',
  'body',
  'cta',
  'assetId',
  'altText',
  'publicationDate',
  'utm',
  'proofIds',
  'owner',
  'status',
];

describe('Pré-rentrée 2026 full campaign source', () => {
  it('exists before validating its publication contract', () => {
    expect(existsSync(sourcePath)).toBe(true);
  });

  it('contains every required campaign family and volume', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

    expect(source.publications).toHaveLength(13);
    expect(source.carousels).toHaveLength(8);
    expect(source.stories).toHaveLength(12);
    expect(source.reels).toHaveLength(3);
    expect(source.stories.every((story: { frames: unknown[] }) => story.frames.length === 3)).toBe(true);
    expect(source.carousels.every((carousel: { slides: unknown[] }) => carousel.slides.length >= 5)).toBe(true);
  });

  it('gives every public content item complete publication metadata and copy', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const items = [...source.publications, ...source.carousels, ...source.stories, ...source.reels];

    for (const item of items) {
      for (const field of requiredFields) {
        expect(item[field]).toBeDefined();
      }
      expect(item.hook.length).toBeGreaterThan(12);
      expect(item.body.length).toBeGreaterThan(80);
      expect(item.cta.length).toBeGreaterThan(8);
      expect(item.altText.length).toBeGreaterThan(40);
      expect(item.proofIds.length).toBeGreaterThan(0);
      expect(item.utm.source).toBeTruthy();
      expect(item.utm.medium).toBeTruthy();
      expect(item.utm.campaign).toBe('pre_rentree_2026');
      expect(item.utm.content).toBeTruthy();
    }
  });

  it('uses only approved proof identifiers and approved offer identifiers', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
    const registry = JSON.parse(readFileSync(proofsPath, 'utf8'));
    const approvedProofIds = new Set(
      registry.proofs.filter((proof: { status: string }) => proof.status === 'APPROVED').map((proof: { proofId: string }) => proof.proofId),
    );
    const offerIds = new Set(contract.offers.map((offer: { offerId: string }) => offer.offerId));
    const items = [...source.publications, ...source.carousels, ...source.stories, ...source.reels];

    for (const item of items) {
      expect(item.proofIds.every((proofId: string) => approvedProofIds.has(proofId))).toBe(true);
      expect((item.offerIds ?? []).every((offerId: string) => offerIds.has(offerId))).toBe(true);
    }
  });

  it('keeps hidden benefits and internal vocabulary out of public copy', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const publicCopy = JSON.stringify([
      source.publications,
      source.carousels,
      source.stories,
      source.reels,
    ]);

    expect(publicCopy).not.toMatch(/\b(?:Gate|REVIEW|blocked|placeholder)\b/i);
    expect(publicCopy).not.toMatch(/SNT/i);
    expect(publicCopy).not.toMatch(/manuel offert|remise annuelle|réduction annuelle|10\s*%/i);
    expect(publicCopy).not.toMatch(/garantie de résultat|places très limitées/i);
    expect(publicCopy).not.toMatch(/\b(?:350|400|900|1700|2400|3000)\s*TND\b/i);
  });

  it('schedules all content no later than the stage start', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const items = [...source.publications, ...source.carousels, ...source.stories, ...source.reels];

    expect(items.every((item) => item.publicationDate >= '2026-07-20' && item.publicationDate <= '2026-08-17')).toBe(true);
  });
});
