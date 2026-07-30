import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repositoryRoot = process.cwd();
const lockfile = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package-lock.json'), 'utf8'),
);

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

const bracePackages = Object.entries(lockfile.packages ?? {})
  .filter(([packagePath, metadata]) => (
    packagePath.endsWith('node_modules/brace-expansion')
    && typeof metadata?.version === 'string'
  ))
  .map(([packagePath, metadata]) => ({
    packagePath,
    version: metadata.version,
  }));

if (bracePackages.length === 0) {
  throw new Error('BRACE_EXPANSION_NOT_INSTALLED');
}

const vulnerable = bracePackages.filter(
  ({ version }) => compareVersions(version, '5.0.8') < 0,
);
if (vulnerable.length > 0) {
  throw new Error(
    `BRACE_EXPANSION_VULNERABLE:${vulnerable
      .map(({ packagePath, version }) => `${packagePath}@${version}`)
      .join(',')}`,
  );
}

for (const { packagePath, version } of bracePackages) {
  const packageDirectory = path.join(repositoryRoot, packagePath);
  const requireFromPackage = createRequire(
    path.join(packageDirectory, 'package.json'),
  );
  const implementation = requireFromPackage(packageDirectory);
  if (
    typeof implementation.expand !== 'function'
    || implementation.EXPANSION_MAX_LENGTH !== 4_000_000
  ) {
    throw new Error(`BRACE_EXPANSION_PATCH_MISSING:${packagePath}@${version}`);
  }
}

const minimatchPackages = Object.entries(lockfile.packages ?? {})
  .filter(([packagePath, metadata]) => (
    packagePath.endsWith('node_modules/minimatch')
    && typeof metadata?.version === 'string'
  ));

for (const [packagePath, metadata] of minimatchPackages) {
  const packageDirectory = path.join(repositoryRoot, packagePath);
  const requireFromPackage = createRequire(
    path.join(packageDirectory, 'package.json'),
  );
  const implementation = requireFromPackage(packageDirectory);
  const braceExpand = typeof implementation === 'function'
    ? implementation.braceExpand
    : implementation.braceExpand;
  if (typeof braceExpand !== 'function') {
    throw new Error(`MINIMATCH_BRACE_API_MISSING:${packagePath}`);
  }
  const result = braceExpand('report-{parent,student}.json');
  if (
    result.length !== 2
    || result[0] !== 'report-parent.json'
    || result[1] !== 'report-student.json'
  ) {
    throw new Error(`MINIMATCH_BRACE_API_INCOMPATIBLE:${packagePath}`);
  }

  if (metadata.version === '9.0.9') {
    const esmEntry = path.join(packageDirectory, 'dist/esm/index.js');
    const esmImplementation = await import(pathToFileURL(esmEntry).href);
    if (
      JSON.stringify(esmImplementation.braceExpand('a{b,c}'))
      !== JSON.stringify(['ab', 'ac'])
    ) {
      throw new Error(`MINIMATCH_ESM_BRACE_API_INCOMPATIBLE:${packagePath}`);
    }
  }
}

process.stdout.write(`${JSON.stringify({
  BRACE_EXPANSION_VULNERABLE_VERSION_COUNT: 0,
  BRACE_EXPANSION_5_0_8_OR_HIGHER_COUNT: bracePackages.length,
  installed: bracePackages,
})}\n`);

