import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Seed du stage Printemps 2026', () => {
  it('conserve le stage fermé sur une base neuve comme sur une base existante', () => {
    const seedSource = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');
    const upsertStart = seedSource.indexOf(
      'const stagePrintemps = await prisma.stage.upsert({',
    );
    const sessionsStart = seedSource.indexOf(
      'await prisma.stageSession.createMany({',
      upsertStart,
    );

    expect(upsertStart).toBeGreaterThanOrEqual(0);
    expect(sessionsStart).toBeGreaterThan(upsertStart);

    const printempsUpsert = seedSource.slice(upsertStart, sessionsStart);
    const createStart = printempsUpsert.indexOf('create: {');

    expect(printempsUpsert).toMatch(
      /where:\s*\{\s*slug:\s*'printemps-2026'\s*\}/,
    );
    expect(printempsUpsert).toMatch(
      /update:\s*\{\s*isVisible:\s*false,\s*isOpen:\s*false,?\s*\}/,
    );
    expect(createStart).toBeGreaterThanOrEqual(0);

    const createBranch = printempsUpsert.slice(createStart);
    expect(createBranch).toMatch(/\bisVisible:\s*false\b/);
    expect(createBranch).toMatch(/\bisOpen:\s*false\b/);
    expect(createBranch).not.toMatch(/\bis(?:Visible|Open):\s*true\b/);
  });
});
