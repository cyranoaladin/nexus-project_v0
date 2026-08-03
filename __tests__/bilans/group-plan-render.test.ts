import fs from 'node:fs';
import path from 'node:path';

import { buildGroupPlanExampleArtifacts } from '@/scripts/bilans/generate-group-plan-example';

describe('A111 internal group plan rendering', () => {
  jest.setTimeout(90_000);
  it('matches the committed HTML/PDF example byte-for-byte', async () => {
    const artifacts = await buildGroupPlanExampleArtifacts();
    expect([...artifacts.keys()].sort()).toEqual(['entree-premiere-maths-v1-groupe.html', 'entree-premiere-maths-v1-groupe.pdf']);
    for (const [name, content] of artifacts) expect(content).toEqual(fs.readFileSync(path.join(process.cwd(), 'docs/specs/bilans/exemples', name)));
    const html = artifacts.get('entree-premiere-maths-v1-groupe.html')!.toString('utf8');
    expect(html).toContain('Document interne confidentiel');
    expect(html).toContain('Élève A (synthétique)');
    expect(html).toContain('Séance 5 sur 5');
    expect(html).toContain('minutes de contenu planifié');
  });
});
