import { resolveOfficialPdfRelativePath } from '@/lib/programme/official-pdf-path';
import type { OfficialPdfMetadata } from '@/lib/programme/official-pdfs';

const metadata = (
  baseDir: string,
  filename: string,
): OfficialPdfMetadata => ({
  slug: 'test-pdf',
  baseDir,
  filename,
  title: 'Test PDF',
  category: 'PROGRAM',
  level: 'PREMIERE',
  track: 'BOTH',
  source: 'MEN',
});

describe('resolveOfficialPdfRelativePath', () => {
  it.each([
    ['programmes', 'document.pdf', 'document.pdf'],
    [
      'programmes/automatismes-eds-premiere',
      'document.pdf',
      'automatismes-eds-premiere/document.pdf',
    ],
  ])(
    'resolves %s/%s inside the programmes root',
    (baseDir, filename, expected) => {
      expect(resolveOfficialPdfRelativePath(metadata(baseDir, filename))).toBe(
        expected,
      );
    },
  );

  it.each([
    ['', 'document.pdf'],
    ['programmes-malicious', 'document.pdf'],
    ['/programmes', 'document.pdf'],
    ['programmes/', 'document.pdf'],
    ['programmes//nested', 'document.pdf'],
    ['programmes/./nested', 'document.pdf'],
    ['programmes/../secrets', 'document.pdf'],
    ['programmes\\nested', 'document.pdf'],
    ['programmes\0nested', 'document.pdf'],
    ['programmes', ''],
    ['programmes', '.'],
    ['programmes', '..'],
    ['programmes', '../secret.pdf'],
    ['programmes', 'nested/document.pdf'],
    ['programmes', 'nested\\document.pdf'],
    ['programmes', '/tmp/document.pdf'],
    ['programmes', 'document\0.pdf'],
  ])('rejects baseDir=%j and filename=%j', (baseDir, filename) => {
    expect(() => resolveOfficialPdfRelativePath(metadata(baseDir, filename))).toThrow(
      'Invalid official PDF path metadata',
    );
  });
});
