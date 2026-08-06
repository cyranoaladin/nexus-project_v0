import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  createReviewRegistry,
  loadReviewRegistry,
  writeReviewRegistry,
} from '@/lib/bilans/catalog/review-registry';
import { buildPack } from '@/scripts/bilans/yaml-bank-to-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-review-registry-test');
const SOURCE = 'data/bilans/banks/entree-terminale-maths-v1.yaml';
const CPS = 'data/bilans/cps/1re-maths-vers-terminale.v1.yaml';
const TEMPLATE = 'data/bilans/banks/maths-terminale-bilan-v1.json';
const PROMPTS = 'content/bilans/prompts/entree-terminale-maths-v1';
const REVIEWER_ID = 'coach-profile-real-1';

function relative(absolutePath: string): string {
  return path.relative(ROOT, absolutePath);
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function prepareFixture(): Readonly<{
  sourcePath: string;
  promptDirectory: string;
  reviewDirectory: string;
}> {
  fs.rmSync(TEMP, { recursive: true, force: true });
  fs.mkdirSync(TEMP, { recursive: true });
  const sourcePath = path.join(TEMP, 'entree-terminale-maths-v1.yaml');
  const promptDirectory = path.join(TEMP, 'prompts');
  const reviewDirectory = path.join(TEMP, 'reviews');
  fs.copyFileSync(path.join(ROOT, SOURCE), sourcePath);
  fs.cpSync(path.join(ROOT, PROMPTS), promptDirectory, { recursive: true });
  return {
    sourcePath: relative(sourcePath),
    promptDirectory: relative(promptDirectory),
    reviewDirectory: relative(reviewDirectory),
  };
}

function signFixture(fixture: ReturnType<typeof prepareFixture>) {
  const registry = createReviewRegistry({
    slug: 'entree-terminale-maths-v1',
    packVersion: 1,
    sourcePath: fixture.sourcePath,
    promptDirectory: fixture.promptDirectory,
    validatedBy: REVIEWER_ID,
    validatedAt: '2026-08-03T08:00:00.000Z',
    qualification: 'Enseignant de mathématiques',
  });
  writeReviewRegistry(registry, fixture.reviewDirectory);
  return registry;
}

function build(fixture: ReturnType<typeof prepareFixture>, reviewerIds = new Set([REVIEWER_ID])) {
  return buildPack({
    sourcePath: fixture.sourcePath,
    cpsPath: CPS,
    templatePackPath: TEMPLATE,
    promptDirectory: fixture.promptDirectory,
    reviewDirectory: fixture.reviewDirectory,
    resolvedReviewerIds: reviewerIds,
  });
}

afterEach(() => fs.rmSync(TEMP, { recursive: true, force: true }));

describe('versioned pedagogical review registry', () => {
  it('stores only the CoachProfile id and exact content checksums', () => {
    const fixture = prepareFixture();
    const registry = signFixture(fixture);
    const loaded = loadReviewRegistry('entree-terminale-maths-v1', fixture.reviewDirectory);

    expect(loaded).toEqual(registry);
    expect(loaded).toMatchObject({
      schemaVersion: 1,
      slug: 'entree-terminale-maths-v1',
      packVersion: 1,
      validatedBy: REVIEWER_ID,
      qualification: 'Enseignant de mathématiques',
    });
    expect(loaded?.sourceChecksum).toBe(sha256(fs.readFileSync(path.join(ROOT, fixture.sourcePath), 'utf8')));
    expect(Object.keys(loaded?.promptChecksums ?? {}).sort()).toEqual([
      'eleve', 'nexus', 'parents', 'preAnalysis', 'verifier',
    ]);
    expect(JSON.stringify(loaded)).not.toContain('@');
  });

  it('derives VALIDATED only when the registry, checksums and CoachProfile all match', () => {
    const fixture = prepareFixture();
    signFixture(fixture);

    expect(build(fixture)).toMatchObject({
      status: 'VALIDATED',
      review: {
        validatedBy: REVIEWER_ID,
        validatedAt: '2026-08-03T08:00:00.000Z',
      },
    });
  });

  it('falls back to an unsigned DRAFT when the source changes after signature', () => {
    const fixture = prepareFixture();
    signFixture(fixture);
    fs.appendFileSync(path.join(ROOT, fixture.sourcePath), '\n# changed after signature\n', 'utf8');

    expect(build(fixture)).toMatchObject({
      status: 'DRAFT',
      review: { validatedBy: null, validatedAt: null },
    });
  });

  it('falls back to an unsigned DRAFT when a prompt changes after signature', () => {
    const fixture = prepareFixture();
    signFixture(fixture);
    fs.appendFileSync(path.join(ROOT, fixture.promptDirectory, 'parents.md'), '\nChanged after signature.\n', 'utf8');

    expect(build(fixture)).toMatchObject({
      status: 'DRAFT',
      review: { validatedBy: null, validatedAt: null },
    });
  });

  it('falls back to an unsigned DRAFT when the CoachProfile no longer resolves', () => {
    const fixture = prepareFixture();
    signFixture(fixture);

    expect(build(fixture, new Set())).toMatchObject({
      status: 'DRAFT',
      review: { validatedBy: null, validatedAt: null },
    });
  });
});
