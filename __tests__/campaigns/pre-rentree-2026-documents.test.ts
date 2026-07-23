import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import documentManifest from '@/assets/campaigns/pre-rentree-2026/documents-final/manifest.json';
import { PRE_RENTREE_DOCUMENTS } from '@/lib/campaigns/pre-rentree-2026/documents';

describe('Pré-rentrée 2026 downloadable document contract', () => {
  it('derives displayed weights from the generated document manifest', () => {
    const candidateByName = new Map(
      documentManifest.documents
        .filter(({ publicDownloadCandidate }) => publicDownloadCandidate)
        .map((document) => [document.fileName, document]),
    );

    expect(PRE_RENTREE_DOCUMENTS).toHaveLength(6);
    for (const document of PRE_RENTREE_DOCUMENTS) {
      const fileName = basename(document.href);
      const generated = candidateByName.get(fileName);
      expect(generated).toBeDefined();
      expect(document.size).toBe(generated?.sizeLabel);

      const assetBytes = readFileSync(join(
        process.cwd(),
        'assets/campaigns/pre-rentree-2026/documents-final',
        fileName,
      ));
      const publicBytes = readFileSync(join(
        process.cwd(),
        'public/documents/pre-rentree-2026',
        fileName,
      ));
      expect(createHash('sha256').update(publicBytes).digest('hex')).toBe(
        createHash('sha256').update(assetBytes).digest('hex'),
      );
    }
  });

  it('keeps SVT drafts and the family intake form out of public downloads', () => {
    const publicNames = PRE_RENTREE_DOCUMENTS.map(({ href }) => basename(href));
    expect(publicNames.every((name) => !name.includes('SVT'))).toBe(true);
    expect(publicNames.every((name) => !name.includes('DossierAccueil'))).toBe(true);
  });
});
