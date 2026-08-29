import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
);
const lockfile = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package-lock.json'), 'utf8'),
);
const dependencyPatchScript = path.join(
  repositoryRoot,
  'scripts/security/apply-brace-expansion-compat.mjs',
);

if (manifest.scripts?.postinstall) {
  throw new Error('POSTINSTALL_DEPENDENCY_PATCH_PRESENT');
}
if (manifest.overrides?.['brace-expansion']) {
  throw new Error('BRACE_EXPANSION_OVERRIDE_PRESENT');
}
if (fs.existsSync(dependencyPatchScript)) {
  throw new Error('DEPENDENCY_PATCH_SCRIPT_PRESENT');
}

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
  if (compareVersions(metadata.version, '10.0.0') < 0) {
    throw new Error(
      `MINIMATCH_HISTORICAL_LINE_PRESENT:${packagePath}@${metadata.version}`,
    );
  }
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

}

process.stdout.write(`${JSON.stringify({
  POSTINSTALL_DEPENDENCY_PATCH_COUNT: 0,
  NODE_MODULES_MUTATED_AFTER_INSTALL_COUNT: 0,
  BRACE_EXPANSION_VULNERABLE_VERSION_COUNT: 0,
  BRACE_EXPANSION_5_0_8_OR_HIGHER_COUNT: bracePackages.length,
  MINIMATCH_HISTORICAL_VERSION_COUNT: 0,
  installed: bracePackages,
})}\n`);
