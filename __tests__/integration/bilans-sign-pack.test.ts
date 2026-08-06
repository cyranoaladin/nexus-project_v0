jest.unmock('@/lib/prisma');

import fs from 'node:fs';
import path from 'node:path';

import { loadReviewRegistry } from '@/lib/bilans/catalog/review-registry';
import { prisma } from '@/lib/prisma';
import {
  createPrismaCoachProfileLookup,
  signPacks,
} from '@/scripts/bilans/sign-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-sign-pack-integration');
const MANIFEST = 'data/bilans/banks/wave1.manifest.json';
const SLUG = 'entree-premiere-maths-v1';
const PREFIX = `a897-${Date.now()}-`;
const EMAIL = `${PREFIX}coach@example.test`;

describe('A89.7 real CoachProfile resolution', () => {
  let coachId: string;
  let manifestPath: string;
  let reviewDirectory: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: EMAIL, role: 'COACH', firstName: 'Test', lastName: 'Reviewer' },
    });
    coachId = (await prisma.coachProfile.create({
      data: { userId: user.id, pseudonym: `${PREFIX}coach`, subjects: '[]' },
    })).id;

    fs.mkdirSync(TEMP, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8')) as any;
    const entry = manifest.banks.find((candidate: any) => candidate.slug === SLUG);
    const sourcePath = path.join(TEMP, 'sources', `${SLUG}.yaml`);
    const promptDirectory = path.join(TEMP, 'prompts', SLUG);
    const outputPath = path.join(TEMP, 'packs', `${SLUG}.json`);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.copyFileSync(path.join(ROOT, entry.source), sourcePath);
    fs.cpSync(path.join(ROOT, entry.promptDirectory), promptDirectory, { recursive: true });
    entry.source = path.relative(ROOT, sourcePath);
    entry.promptDirectory = path.relative(ROOT, promptDirectory);
    entry.output = path.relative(ROOT, outputPath);
    manifest.banks = [entry];
    manifest.expectedActiveBanks = 1;
    manifest.expectedItems = 18;
    const absoluteManifest = path.join(TEMP, 'wave1.manifest.json');
    fs.writeFileSync(absoluteManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    manifestPath = path.relative(ROOT, absoluteManifest);
    reviewDirectory = path.relative(ROOT, path.join(TEMP, 'reviews'));
  });

  afterAll(async () => {
    fs.rmSync(TEMP, { recursive: true, force: true });
    await prisma.coachProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('resolves a real CoachProfile by email and stores only its id', async () => {
    const lookup = createPrismaCoachProfileLookup(prisma);
    await expect(lookup.findByEmail('unknown@example.test')).resolves.toBeNull();

    await expect(signPacks({
      slugs: [SLUG],
      email: EMAIL,
      qualification: 'Enseignant test de mathématiques',
      manifestPath,
      reviewDirectory,
      coachProfiles: lookup,
      now: () => new Date('2026-08-03T09:30:00.000Z'),
    })).resolves.toEqual([{ slug: SLUG, status: 'SIGNED', validatedBy: coachId }]);

    const registry = loadReviewRegistry(SLUG, reviewDirectory);
    expect(registry?.validatedBy).toBe(coachId);
    expect(JSON.stringify(registry)).not.toContain(EMAIL);
  });
});
