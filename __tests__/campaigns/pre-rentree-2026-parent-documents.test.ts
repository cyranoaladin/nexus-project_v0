import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sourcePath = join(root, 'content/pre-rentree-2026/parent-documents.fr.json');

const expectedDocumentIds = [
  'brochure-generale',
  'guide-parent',
  'fiche-3e',
  'fiche-seconde',
  'fiche-premiere',
  'fiche-terminale',
  'comparatif-fondations-premium',
  'inclusions-options-exclusions',
  'justification-tarifaire',
  'faq-commerciale',
  'procedure-inscription',
  'conditions-reservation-acompte',
  'accompagnements-annuels',
  'passerelle-stage-annuel',
];

describe('Pré-rentrée 2026 parent document sources', () => {
  it('defines the complete requested inventory', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

    expect(source.documents.map((document: { documentId: string }) => document.documentId)).toEqual(
      expectedDocumentIds,
    );
  });

  it('contains complete parent-facing copy, CTA and evidence references', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

    expect(source.documents.every((document: Record<string, unknown>) => (
      typeof document.title === 'string'
      && typeof document.purpose === 'string'
      && Array.isArray(document.sections)
      && document.sections.length >= 3
      && typeof document.cta === 'string'
      && Array.isArray(document.proofIds)
      && document.proofIds.length > 0
    ))).toBe(true);
    expect(JSON.stringify(source.documents).length).toBeGreaterThan(22_000);
  });

  it('references canonical offers instead of embedding commercial amounts', () => {
    const sourceText = readFileSync(sourcePath, 'utf8');
    const source = JSON.parse(sourceText);
    const offerIds = source.documents.flatMap((document: { offerIds?: string[] }) => document.offerIds ?? []);

    expect(offerIds.length).toBeGreaterThan(0);
    expect(offerIds.every((offerId: string) => offerId.startsWith('pre2026-'))).toBe(true);
    expect(sourceText).not.toMatch(/\b(?:350|400|900|1700|2400|3000)\s*TND\b/i);
    expect(sourceText).not.toMatch(/"(?:price|deposit|balance)"\s*:/i);
  });

  it('does not expose unsupported services or internal publication vocabulary', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const publicCopy = JSON.stringify(source.documents);

    expect(publicCopy).not.toMatch(/\b(?:Gate|REVIEW|blocked|owner|placeholder)\b/i);
    expect(publicCopy).not.toMatch(/SNT/i);
    expect(publicCopy).not.toMatch(/manuel offert|remise annuelle|réduction annuelle|10\s*%/i);
    expect(publicCopy).not.toMatch(/garanti|garantie de résultat|places très limitées/i);
  });
});
