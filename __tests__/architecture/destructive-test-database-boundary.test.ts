import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('destructive test database boundary', () => {
  it.each([
    ['e2e/helpers/db.ts', 'assertDisposableE2eDatabase'],
    ['__tests__/setup/test-database.ts', 'assertDisposablePostgresUrl'],
  ])('%s validates its URL before constructing PrismaClient', (relativePath, guard) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
    const guardCall = source.indexOf(`${guard}(`);
    const clientConstruction = source.indexOf('new PrismaClient(');

    expect(source).toContain(`import { ${guard} }`);
    expect(guardCall).toBeGreaterThanOrEqual(0);
    expect(clientConstruction).toBeGreaterThan(guardCall);
  });
});
