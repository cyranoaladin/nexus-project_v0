import fs from 'node:fs';
import path from 'node:path';

import { buildRenderedExampleArtifacts } from '@/scripts/bilans/generate-rendered-examples';
import { assertVersionedPdfChromium } from './helpers/pdf-engine';

describe('A95 versioned Canonical rendered examples', () => {
  jest.setTimeout(90_000);

  it('matches the six committed HTML/PDF artifacts byte-for-byte', async () => {
    assertVersionedPdfChromium();
    const artifacts = await buildRenderedExampleArtifacts();
    expect([...artifacts.keys()].sort()).toEqual([
      'entree-premiere-maths-v1-eleve.html',
      'entree-premiere-maths-v1-eleve.pdf',
      'entree-premiere-maths-v1-nexus.html',
      'entree-premiere-maths-v1-nexus.pdf',
      'entree-premiere-maths-v1-parents.html',
      'entree-premiere-maths-v1-parents.pdf',
    ]);

    for (const [name, content] of artifacts) {
      const committed = fs.readFileSync(path.join(process.cwd(), 'docs', 'specs', 'bilans', 'exemples', name));
      expect(content).toEqual(committed);
    }
  });
});
