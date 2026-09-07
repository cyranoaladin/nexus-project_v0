import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function productionFiles(): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        files.push(relative(root, absolutePath));
      }
    }
  };

  for (const directory of ['app', 'components', 'lib']) {
    visit(join(root, directory));
  }
  return files;
}

function hasLegacyRagReference(source: string): boolean {
  const legacySearchEndpoint = /(?:['"`]\/search|\$\{[^}]+\}\/search|https?:\/\/[^\s'"`]+\/search)(?!\/v2(?:[/?#'"`]|$))(?=[/?#'"`]|$)/;
  return /['"][^'"\n]*\/rag-client(?:\.[cm]?[jt]sx?)?['"]/.test(source)
    || source.includes('RAG_INGESTOR_URL')
    || source.includes('RAG_API_TOKEN')
    || legacySearchEndpoint.test(source);
}

function exposesStorageEngine(source: string): boolean {
  return /\b(?:ChromaDB|pgvector)\b|source:\s*['"]chroma['"]/i.test(source);
}

describe('COCKPIT_RAG_V2_CLIENT product boundary', () => {
  it('has retired the legacy /search client from product code', () => {
    expect(existsSync(`${root}/lib/rag-client.ts`)).toBe(false);

    const violations = productionFiles().filter((file) => {
      const source = readFileSync(`${root}/${file}`, 'utf8');
      return hasLegacyRagReference(source);
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
      exposesStorageEngine(readFileSync(`${root}/${file}`, 'utf8')),
    );
    expect(violations).toEqual([]);
  });

  it.each([
    "import { ragSearch } from '../../lib/rag-client'",
    "fetch('/search?collection=maths')",
    "fetch('/search/')",
    "fetch('/search/v1')",
    'const url = `${baseUrl}/search/`',
  ])('detects a legacy product-path bypass: %s', (source) => {
    expect(hasLegacyRagReference(source)).toBe(true);
  });

  it('allows the canonical /search/v2 route', () => {
    expect(hasLegacyRagReference("fetch('/search/v2')")).toBe(false);
  });

  it.each([
    'source: "chroma"',
    "source: 'chroma'",
    'backend: "ChromaDB"',
    'backend: "pgvector"',
  ])('detects a storage-engine UI label: %s', (source) => {
    expect(exposesStorageEngine(source)).toBe(true);
  });
});
