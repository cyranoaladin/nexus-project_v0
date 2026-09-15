import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = '.github/governance/container-images.json';

type Purpose =
  | 'REQUIRED_CI'
  | 'E2E'
  | 'MIGRATION_REHEARSAL'
  | 'LOCAL_DEV'
  | 'LEGACY'
  | 'PRODUCTION_REFERENCE'
  | 'OBSOLETE';

interface RegistryImage {
  logicalName: string;
  repository: string;
  humanTag: string;
  digest: string;
  platforms: string[];
  purpose: Purpose[];
  rationale: string;
}

interface Registry {
  schemaVersion: string;
  repository: string;
  images: RegistryImage[];
}

const registry: Registry = JSON.parse(readFileSync(path.join(REPO_ROOT, REGISTRY_PATH), 'utf8'));

/**
 * Executable references only. Documentation may name a mutable tag; nothing
 * executes a Markdown file. `git ls-files` keeps the scan to tracked files and
 * out of node_modules and build output.
 */
function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function isExecutableSurface(file: string): boolean {
  if (file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file)) return true;
  if (/^docker-compose[.\w-]*\.ya?ml$/.test(file)) return true;
  if (/^Dockerfile[.\w-]*$/.test(file)) return true;
  if (file.startsWith('scripts/') && file.endsWith('.sh')) return true;
  return false;
}

const IMAGE_REFERENCE_SHAPE = '(?:[a-z0-9][a-z0-9._-]*\\/)?[a-z0-9][a-z0-9._-]*';
const DIGEST_REF = new RegExp(`^(${IMAGE_REFERENCE_SHAPE})@(sha256:[a-f0-9]{64})$`);
const TAG_REF = new RegExp(`^(${IMAGE_REFERENCE_SHAPE}):([A-Za-z0-9._-]+)$`);

interface Reference {
  file: string;
  line: number;
  raw: string;
}

/** Strip a trailing `# comment` that documents the human tag. */
function stripQuotes(token: string): string {
  return token.replace(/["']/g, '').trim();
}

function collectReferences(): Reference[] {
  const found: Reference[] = [];
  const repositories = new Set(registry.images.map((image) => image.repository));

  for (const file of trackedFiles().filter(isExecutableSurface)) {
    const contents = readFileSync(path.join(REPO_ROOT, file), 'utf8');

    contents.split('\n').forEach((line, index) => {
      const lineNumber = index + 1;
      const withoutComment = line.replace(/#.*$/, '');
      const isCommented = /^\s*#/.test(line);

      // YAML service definitions.
      const yamlMatch = withoutComment.match(/^\s*image:\s*(\S+)/);
      if (yamlMatch && !isCommented) {
        found.push({ file, line: lineNumber, raw: stripQuotes(yamlMatch[1]) });
        return;
      }

      if (isCommented) return;

      // Any token naming a repository the registry already governs. This is what
      // catches a digest silently drifting back to a mutable tag.
      for (const repository of repositories) {
        const escaped = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?:^|[\\s"'=])(${escaped}(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{64}))(?=$|[\\s"'>;)])`, 'g');
        for (const match of withoutComment.matchAll(pattern)) {
          found.push({ file, line: lineNumber, raw: stripQuotes(match[1]) });
        }
      }

      // A repository the registry has never heard of, introduced through docker
      // directly or through a pinned variable.
      if (/docker\s+(run|pull|create)|pull_image_with_retry|_IMAGE=/.test(withoutComment)) {
        const pattern = new RegExp(`(?:^|[\\s"'=])(${IMAGE_REFERENCE_SHAPE}(?::[A-Za-z0-9._-]+|@sha256:[a-f0-9]{64}))(?=$|[\\s"'>;)])`, 'g');
        for (const match of withoutComment.matchAll(pattern)) {
          const raw = stripQuotes(match[1]);
          if (/^(docker|sha256)/.test(raw)) continue;
          found.push({ file, line: lineNumber, raw });
        }
      }
    });
  }

  // One line can match several patterns; a reference is identified by where it is.
  const unique = new Map<string, Reference>();
  for (const reference of found) {
    unique.set(`${reference.file}:${reference.line}:${reference.raw}`, reference);
  }
  return [...unique.values()];
}

const references = collectReferences();

function describeReference(reference: Reference): string {
  return `${reference.file}:${reference.line} -> ${reference.raw}`;
}

describe('container image authority', () => {
  describe('the registry itself', () => {
    it('declares a unique logical name per image', () => {
      const names = registry.images.map((image) => image.logicalName);
      expect(names).toHaveLength(new Set(names).size);
    });

    it('never maps one logical image to more than one digest', () => {
      const byLogicalName = new Map<string, Set<string>>();
      for (const image of registry.images) {
        if (!byLogicalName.has(image.logicalName)) byLogicalName.set(image.logicalName, new Set());
        byLogicalName.get(image.logicalName)!.add(image.digest);
      }
      const conflicting = [...byLogicalName.entries()]
        .filter(([, digests]) => digests.size > 1)
        .map(([name, digests]) => `${name}: ${[...digests].join(', ')}`);
      expect(conflicting).toEqual([]);
    });

    it('never maps one repository-and-tag pair to more than one digest', () => {
      const byTag = new Map<string, Set<string>>();
      for (const image of registry.images) {
        const key = `${image.repository}:${image.humanTag}`;
        if (!byTag.has(key)) byTag.set(key, new Set());
        byTag.get(key)!.add(image.digest);
      }
      const conflicting = [...byTag.entries()]
        .filter(([, digests]) => digests.size > 1)
        .map(([key, digests]) => `${key}: ${[...digests].join(', ')}`);
      expect(conflicting).toEqual([]);
    });

    it('pins every image to a well-formed digest', () => {
      const malformed = registry.images
        .filter((image) => !/^sha256:[a-f0-9]{64}$/.test(image.digest))
        .map((image) => `${image.logicalName}: ${image.digest}`);
      expect(malformed).toEqual([]);
    });

    it('declares linux/amd64 support for every image CI can execute', () => {
      const executable: Purpose[] = ['REQUIRED_CI', 'E2E', 'MIGRATION_REHEARSAL', 'LOCAL_DEV'];
      const unsupported = registry.images
        .filter((image) => image.purpose.some((purpose) => executable.includes(purpose)))
        .filter((image) => !image.platforms.includes('linux/amd64'))
        .map((image) => `${image.logicalName}: ${image.platforms.join(', ')}`);
      expect(unsupported).toEqual([]);
    });
  });

  describe('executable references are projections of the registry', () => {
    it('finds the references it is meant to govern', () => {
      // A scanner that silently matches nothing would make every assertion below vacuous.
      expect(references.length).toBeGreaterThan(10);
    });

    it('pins every executable reference by digest, never by a mutable tag', () => {
      const mutable = references
        .filter((reference) => TAG_REF.test(reference.raw))
        .map(describeReference);
      expect(mutable).toEqual([]);
    });

    it('resolves every executable reference to a registered image', () => {
      const known = new Set(registry.images.map((image) => `${image.repository}@${image.digest}`));
      const unknown = references
        .filter((reference) => DIGEST_REF.test(reference.raw))
        .filter((reference) => !known.has(reference.raw))
        .map(describeReference);
      expect(unknown).toEqual([]);
    });

    it('never references a digest the registry does not carry', () => {
      const digests = new Set(registry.images.map((image) => image.digest));
      const drifted = references
        .map((reference) => ({ reference, match: reference.raw.match(DIGEST_REF) }))
        .filter(({ match }) => match && !digests.has(match[2]))
        .map(({ reference }) => describeReference(reference));
      expect(drifted).toEqual([]);
    });

    it('uses one digest per repository across the whole repository', () => {
      const byRepository = new Map<string, Set<string>>();
      for (const reference of references) {
        const match = reference.raw.match(DIGEST_REF);
        if (!match) continue;
        const [, repository, digest] = match;
        if (!byRepository.has(repository)) byRepository.set(repository, new Set());
        byRepository.get(repository)!.add(digest);
      }
      const registered = new Map<string, Set<string>>();
      for (const image of registry.images) {
        if (!registered.has(image.repository)) registered.set(image.repository, new Set());
        registered.get(image.repository)!.add(image.digest);
      }
      const drifted = [...byRepository.entries()]
        .filter(([repository, digests]) => {
          const allowed = registered.get(repository);
          return !allowed || [...digests].some((digest) => !allowed.has(digest));
        })
        .map(([repository, digests]) => `${repository}: ${[...digests].join(', ')}`);
      expect(drifted).toEqual([]);
    });
  });

  describe('the disposable database suite pulls exactly what it runs', () => {
    const SUITE = 'scripts/aria/run-disposable-db-suite.sh';
    const source = readFileSync(path.join(REPO_ROOT, SUITE), 'utf8');

    it('warms the retry-wrapped pull with the same reference docker run uses', () => {
      const pulled = source.match(/pull_image_with_retry\s+"?(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|\S+)"?/);
      expect(pulled).not.toBeNull();

      const runReference = source.match(/^\s+"?(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|[a-z0-9][^\s"']*@sha256:[a-f0-9]{64})"?\s*>\s*\/dev\/null/m);
      expect(runReference).not.toBeNull();

      // A mutable pull paired with an immutable run makes the retry useless and
      // lets docker run fall back to an implicit, unretried pull.
      expect(stripQuotes(pulled![1])).toBe(stripQuotes(runReference![1]));
    });

    it('resolves that shared reference to a registered digest', () => {
      const assignment = source.match(/^([A-Z_][A-Z0-9_]*)=["']?([^\s"']+@sha256:[a-f0-9]{64})["']?/m);
      expect(assignment).not.toBeNull();
      const known = new Set(registry.images.map((image) => `${image.repository}@${image.digest}`));
      expect(known.has(assignment![2])).toBe(true);
    });
  });
});
