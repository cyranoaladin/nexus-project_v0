import fs from 'node:fs';
import path from 'node:path';

import { isPackEnabled } from '@/lib/bilans/api/pack-access';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { loadReviewRegistry } from '@/lib/bilans/catalog/review-registry';
import { loadWaveManifest } from '@/lib/bilans/catalog/wave-manifest';
import { convertBankBatch } from '@/scripts/bilans/convert-bank-batch';
import { signPacks } from '@/scripts/bilans/sign-pack';
import { buildPack } from '@/scripts/bilans/yaml-bank-to-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-sign-pack-test');
const BASE_MANIFEST_PATH = 'data/bilans/banks/wave1.manifest.json';
const SLUG = 'entree-terminale-maths-v1';
const REVIEWER_ID = 'coach-profile-test-real';

function prepare(invalid = false) {
  fs.rmSync(TEMP, { recursive: true, force: true });
  fs.mkdirSync(TEMP, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, BASE_MANIFEST_PATH), 'utf8')) as any;
  const entry = manifest.banks.find((candidate: any) => candidate.slug === SLUG);
  const sourcePath = path.join(TEMP, 'sources', `${SLUG}.yaml`);
  const promptDirectory = path.join(TEMP, 'prompts', SLUG);
  const outputPath = path.join(TEMP, 'packs', `${SLUG}.json`);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.copyFileSync(path.join(ROOT, entry.source), sourcePath);
  fs.cpSync(path.join(ROOT, entry.promptDirectory), promptDirectory, { recursive: true });
  if (invalid) {
    const source = fs.readFileSync(sourcePath, 'utf8').replace(/^\s*- id: \S+/m, '  - id: X');
    fs.writeFileSync(sourcePath, source, 'utf8');
  }
  entry.source = path.relative(ROOT, sourcePath);
  entry.promptDirectory = path.relative(ROOT, promptDirectory);
  entry.output = path.relative(ROOT, outputPath);
  const manifestPath = path.join(TEMP, 'wave1.manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    manifestPath: path.relative(ROOT, manifestPath),
    reviewDirectory: path.relative(ROOT, path.join(TEMP, 'reviews')),
    sourcePath: entry.source as string,
    promptDirectory: entry.promptDirectory as string,
    outputPath: entry.output as string,
    cpsPath: entry.cps as string,
  };
}

const knownCoach = {
  findByEmail: jest.fn(async () => ({ id: REVIEWER_ID })),
};
const unknownCoach = {
  findByEmail: jest.fn(async () => null),
};

afterEach(() => {
  fs.rmSync(TEMP, { recursive: true, force: true });
  jest.clearAllMocks();
});

describe('auditable sign-pack command', () => {
  it('refuses an unknown email without writing a registry or a partial pack', async () => {
    const fixture = prepare();
    const result = await signPacks({
      slugs: [SLUG],
      email: 'unknown@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: unknownCoach,
    });

    expect(result).toEqual([{ slug: SLUG, status: 'REFUSED', reason: 'COACH_PROFILE_NOT_FOUND' }]);
    expect(loadReviewRegistry(SLUG, fixture.reviewDirectory)).toBeNull();
    expect(fs.existsSync(path.join(ROOT, fixture.outputPath))).toBe(false);
  });

  it('refuses a bank that fails V1-V14 without writing any signature', async () => {
    const fixture = prepare(true);
    const result = await signPacks({
      slugs: [SLUG],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
    });

    expect(result).toHaveLength(1);
    const refusal = result[0];
    expect(refusal).toMatchObject({ slug: SLUG, status: 'REFUSED' });
    if (refusal?.status !== 'REFUSED') throw new Error('TEST_EXPECTED_SIGNATURE_REFUSAL');
    expect(refusal.reason).toMatch(/V1|BANK_SCHEMA_INVALID/);
    expect(loadReviewRegistry(SLUG, fixture.reviewDirectory)).toBeNull();
    expect(fs.existsSync(path.join(ROOT, fixture.outputPath))).toBe(false);
  });

  it('writes the registry and a VALIDATED pack without enabling its feature flag', async () => {
    const fixture = prepare();
    const result = await signPacks({
      slugs: [SLUG],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
      now: () => new Date('2026-08-03T09:00:00.000Z'),
    });

    expect(result).toEqual([{ slug: SLUG, status: 'SIGNED', validatedBy: REVIEWER_ID }]);
    expect(loadReviewRegistry(SLUG, fixture.reviewDirectory)).toMatchObject({
      validatedBy: REVIEWER_ID,
      validatedAt: '2026-08-03T09:00:00.000Z',
    });
    const pack = loadBilanPack(fixture.outputPath);
    expect(pack).toMatchObject({
      status: 'VALIDATED',
      review: { validatedBy: REVIEWER_ID, validatedAt: '2026-08-03T09:00:00.000Z' },
    });
    expect(isPackEnabled(pack, {})).toBe(false);
  });

  it('keeps an identical signature and generated pack byte-for-byte on replay', async () => {
    const fixture = prepare();
    const base = {
      slugs: [SLUG],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
    } as const;
    await signPacks({ ...base, now: () => new Date('2026-08-03T09:00:00.000Z') });
    const registryPath = path.join(ROOT, fixture.reviewDirectory, `${SLUG}.review.yaml`);
    const firstRegistry = fs.readFileSync(registryPath, 'utf8');
    const firstPack = fs.readFileSync(path.join(ROOT, fixture.outputPath), 'utf8');

    await signPacks({ ...base, now: () => new Date('2026-08-03T12:00:00.000Z') });

    expect(fs.readFileSync(registryPath, 'utf8')).toBe(firstRegistry);
    expect(fs.readFileSync(path.join(ROOT, fixture.outputPath), 'utf8')).toBe(firstPack);
  });

  it('keeps a valid signature when the batch converter resolves its CoachProfile', async () => {
    const fixture = prepare();
    await signPacks({
      slugs: [SLUG],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
      now: () => new Date('2026-08-03T09:00:00.000Z'),
    });

    convertBankBatch({
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      resolvedReviewerIds: new Set([REVIEWER_ID]),
      write: true,
    });

    expect(loadBilanPack(fixture.outputPath)).toMatchObject({
      status: 'VALIDATED',
      review: { validatedBy: REVIEWER_ID },
    });
  });

  it('signs valid slugs independently and reports an unknown slug without rolling back success', async () => {
    const fixture = prepare();
    const result = await signPacks({
      slugs: [SLUG, 'pack-inconnu-v1'],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
      now: () => new Date('2026-08-03T09:00:00.000Z'),
    });

    expect(result).toEqual([
      { slug: SLUG, status: 'SIGNED', validatedBy: REVIEWER_ID },
      { slug: 'pack-inconnu-v1', status: 'REFUSED', reason: 'PACK_SLUG_UNKNOWN' },
    ]);
    expect(loadReviewRegistry(SLUG, fixture.reviewDirectory)).not.toBeNull();
  });

  it('makes a signed pack fall back to DRAFT after its source changes', async () => {
    const fixture = prepare();
    await signPacks({
      slugs: [SLUG],
      email: 'reviewer@example.test',
      qualification: 'Enseignant de mathématiques',
      manifestPath: fixture.manifestPath,
      reviewDirectory: fixture.reviewDirectory,
      coachProfiles: knownCoach,
      now: () => new Date('2026-08-03T09:00:00.000Z'),
    });
    fs.appendFileSync(path.join(ROOT, fixture.sourcePath), '\n# modified after signature\n', 'utf8');
    const entry = loadWaveManifest(fixture.manifestPath).banks.find(({ slug }) => slug === SLUG)!;

    expect(buildPack({
      sourcePath: entry.source,
      cpsPath: entry.cps,
      templatePackPath: 'data/bilans/banks/maths-terminale-bilan-v1.json',
      promptDirectory: entry.promptDirectory,
      reviewDirectory: fixture.reviewDirectory,
      resolvedReviewerIds: new Set([REVIEWER_ID]),
    })).toMatchObject({
      status: 'DRAFT',
      review: { validatedBy: null, validatedAt: null },
    });
  });
});
