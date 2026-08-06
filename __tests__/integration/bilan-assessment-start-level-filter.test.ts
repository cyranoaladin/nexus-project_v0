jest.unmock('@/lib/prisma');

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { packFeatureFlagName } from '@/lib/bilans/api/pack-access';
import BilanAssessmentPage from '@/app/bilan-gratuit/assessment/page';

const authMock = auth as jest.MockedFunction<typeof auth>;
const PREFIX = `a89-level-filter-${Date.now()}-`;
const SECONDE_FLAG = packFeatureFlagName('entree-seconde-maths-v1');
const TERMINALE_FLAG = packFeatureFlagName('entree-terminale-maths-v1');

describe('Student pack selection is scoped to the student own grade level', () => {
  let studentUserId: string;
  const originalFlags: Record<string, string | undefined> = {};

  beforeAll(async () => {
    originalFlags[SECONDE_FLAG] = process.env[SECONDE_FLAG];
    originalFlags[TERMINALE_FLAG] = process.env[TERMINALE_FLAG];
    process.env[SECONDE_FLAG] = 'true';
    process.env[TERMINALE_FLAG] = 'true';

    const parentUser = await prisma.user.create({ data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' } });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({ data: { email: `${PREFIX}student@example.test`, role: 'ELEVE' } });
    studentUserId = studentUser.id;
    await prisma.student.create({ data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'SECONDE' } });
  });

  afterAll(async () => {
    for (const [flag, value] of Object.entries(originalFlags)) {
      if (value === undefined) delete process.env[flag]; else process.env[flag] = value;
    }
    await prisma.student.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  test('offers only packs matching the student grade level, even though a Terminale pack is also enabled', async () => {
    authMock.mockResolvedValue({ user: { id: studentUserId, role: 'ELEVE' } } as never);

    const element = await BilanAssessmentPage({ searchParams: Promise.resolve({}) }) as unknown as {
      props: { packs: ReadonlyArray<{ slug: string; label: string }> };
    };

    expect(element.props.packs.some((pack) => pack.slug === 'entree-seconde-maths-v1')).toBe(true);
    expect(element.props.packs.some((pack) => pack.slug === 'entree-terminale-maths-v1')).toBe(false);
    expect(element.props.packs.every((pack) => pack.label.startsWith('2de'))).toBe(true);
  });
});
