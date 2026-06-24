import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guard: /offres page and its card components must remain server components.
 * Lot B extracted the client monolith into a server page + client island.
 * This test prevents regression to 'use client' on these files.
 */
describe('Offres server component guard', () => {
  const SERVER_FILES = [
    'app/offres/page.tsx',
    'components/premium/ExamCard.tsx',
    'components/premium/PassCard.tsx',
    'components/premium/CarteNexusCard.tsx',
  ];

  for (const filePath of SERVER_FILES) {
    test(`${filePath} must not contain 'use client'`, () => {
      const content = readFileSync(join(process.cwd(), filePath), 'utf-8');
      expect(content).not.toContain("'use client'");
      expect(content).not.toContain('"use client"');
    });
  }

  test('OffersFiltersClient is the only client island under app/offres/', () => {
    const filterContent = readFileSync(
      join(process.cwd(), 'app/offres/_components/OffersFiltersClient.tsx'),
      'utf-8',
    );
    expect(filterContent).toContain("'use client'");
  });
});
