import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function productionFiles(): string[] {
  return execFileSync('rg', [
    '--files',
    'app',
    'components',
    'lib',
    '-g',
    '*.ts',
    '-g',
    '*.tsx',
  ], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

describe('COCKPIT_RAG_V2_CLIENT product boundary', () => {
  it('has retired the legacy /search client from product code', () => {
    expect(existsSync(`${root}/lib/rag-client.ts`)).toBe(false);

    const violations = productionFiles().filter((file) => {
      const source = readFileSync(`${root}/${file}`, 'utf8');
      return source.includes('@/lib/rag-client')
        || source.includes('RAG_INGESTOR_URL')
        || source.includes('RAG_API_TOKEN')
        || /[`'\"]\/search[`'\"]/.test(source);
    });
    expect(violations).toEqual([]);
  });

  it('does not expose storage engine names in the active Cockpit RAG UI', () => {
    const files = [
      'app/programme/maths-1ere/components/RAGSources.tsx',
      'components/programme/shared/RAG/RAGRemediation.tsx',
      'components/programme/shared/RAG/RAGFlashCard.tsx',
    ];
    const violations = files.filter((file) =>
      /ChromaDB|pgvector|source:\s*'chroma'/.test(readFileSync(`${root}/${file}`, 'utf8')),
    );
    expect(violations).toEqual([]);
  });
});
