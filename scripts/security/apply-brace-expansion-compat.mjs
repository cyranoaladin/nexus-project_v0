import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const lockfilePath = path.join(repositoryRoot, 'package-lock.json');
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));

const supportedPatches = new Map([
  ['3.1.5', [
    {
      relativePath: 'minimatch.js',
      original: "var expand = require('brace-expansion')",
      patched: [
        "var braceExpansion = require('brace-expansion')",
        'var expand = typeof braceExpansion === \'function\'',
        '  ? braceExpansion',
        '  : braceExpansion.expand',
        'if (typeof expand !== \'function\') {',
        '  throw new TypeError(\'brace-expansion must expose expand()\')',
        '}',
      ].join('\n'),
    },
  ]],
  ['9.0.9', [
    {
      relativePath: 'dist/commonjs/index.js',
      original:
        'const brace_expansion_1 = __importDefault(require("brace-expansion"));',
      patched:
        'const { expand: expandBrace } = require("brace-expansion");',
    },
    {
      relativePath: 'dist/commonjs/index.js',
      original: 'return (0, brace_expansion_1.default)(pattern);',
      patched: 'return expandBrace(pattern);',
    },
    {
      relativePath: 'dist/esm/index.js',
      original: "import expand from 'brace-expansion';",
      patched: "import { expand } from 'brace-expansion';",
    },
  ]],
]);

function patchFile(filePath, original, patched) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(patched)) return false;
  if (!source.includes(original)) {
    throw new Error(
      `BRACE_EXPANSION_COMPAT_SOURCE_MISMATCH:${path.relative(
        repositoryRoot,
        filePath,
      )}`,
    );
  }
  fs.writeFileSync(filePath, source.replace(original, patched), 'utf8');
  return true;
}

const minimatchPackages = Object.entries(lockfile.packages ?? {})
  .filter(([packagePath, metadata]) => (
    packagePath.endsWith('node_modules/minimatch')
    && typeof metadata?.version === 'string'
  ));

let patchCount = 0;
for (const [packagePath, metadata] of minimatchPackages) {
  const major = Number.parseInt(metadata.version.split('.')[0] ?? '', 10);
  if (major >= 10) continue;

  const patches = supportedPatches.get(metadata.version);
  if (!patches) {
    throw new Error(
      `BRACE_EXPANSION_COMPAT_UNSUPPORTED_MINIMATCH:${metadata.version}`,
    );
  }

  for (const patch of patches) {
    const filePath = path.join(
      repositoryRoot,
      packagePath,
      patch.relativePath,
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `BRACE_EXPANSION_COMPAT_FILE_MISSING:${path.relative(
          repositoryRoot,
          filePath,
        )}`,
      );
    }
    if (patchFile(filePath, patch.original, patch.patched)) patchCount += 1;
  }
}

process.stdout.write(
  `brace-expansion compatibility verified (${patchCount} patch(es) applied)\n`,
);

