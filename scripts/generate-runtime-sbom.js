#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const exceptionComponentPurl = 'pkg:npm/%40emnapi/runtime@1.11.2';

function sriToCycloneDxHash(integrity) {
  const [algorithm, encoded] = String(integrity).split('-', 2);
  const algorithms = {
    sha256: 'SHA-256',
    sha384: 'SHA-384',
    sha512: 'SHA-512',
  };
  if (!algorithms[algorithm] || !encoded) {
    throw new Error(`Unsupported package-lock integrity: ${integrity}`);
  }
  return {
    alg: algorithms[algorithm],
    content: Buffer.from(encoded, 'base64').toString('hex').toUpperCase(),
  };
}

function splitPackageName(name) {
  if (!name.startsWith('@')) return { name };
  const slash = name.indexOf('/');
  return { group: name.slice(0, slash), name: name.slice(slash + 1) };
}

function augmentWithPhysicalException(sbom, { packageJson, lockPackage, exception }) {
  const components = sbom.components ?? (sbom.components = []);
  let component = components.find((candidate) =>
    candidate.purl === exceptionComponentPurl ||
    (candidate.group === '@emnapi' && candidate.name === 'runtime' && candidate.version === exception.version),
  );

  if (!component) {
    const names = splitPackageName(packageJson.name);
    component = {
      'bom-ref': `nexus:physical-extraneous:${packageJson.name}@${packageJson.version}`,
      type: 'library',
      ...names,
      version: packageJson.version,
      scope: 'optional',
      hashes: [sriToCycloneDxHash(lockPackage.integrity)],
      licenses: packageJson.license
        ? [{ license: { id: packageJson.license } }]
        : undefined,
      purl: exceptionComponentPurl,
    };
    components.push(component);
  }

  component.scope = 'optional';
  component.hashes = component.hashes?.length
    ? component.hashes
    : [sriToCycloneDxHash(lockPackage.integrity)];
  if ((!component.licenses || component.licenses.length === 0) && packageJson.license) {
    component.licenses = [{ license: { id: packageJson.license } }];
  }

  const policyProperties = [
    { name: 'nexus:npm-tree-status', value: exception.type },
    { name: 'nexus:artifact-allowed', value: String(exception.artifactAllowed) },
    { name: 'nexus:exception-owner', value: exception.owner },
    { name: 'nexus:exception-approved-on', value: exception.approvedOn },
    { name: 'nexus:exception-review-by', value: exception.reviewBy },
    { name: 'nexus:exception-expires-on', value: exception.expiresOn },
  ];
  if (exception.upstreamIssue) {
    policyProperties.push({ name: 'nexus:upstream-issue', value: exception.upstreamIssue });
  }
  component.properties = [
    ...(component.properties || []).filter((property) =>
      !policyProperties.some((policy) => policy.name === property.name),
    ),
    ...policyProperties,
  ];

  const annotation = {
    subjects: [component['bom-ref']],
    annotator: {
      component: {
        type: 'application',
        name: 'nexus-sbom-policy',
        version: '1',
      },
    },
    timestamp: '1970-01-01T00:00:00.000Z',
    text: '@emnapi/runtime is physically present because of npm optional dependency materialization and must not enter the production artifact.',
  };
  sbom.annotations = [
    ...(sbom.annotations || []).filter((item) =>
      !item.subjects?.includes(component['bom-ref']),
    ),
    annotation,
  ];
  if (
    Array.isArray(sbom.dependencies)
    && !sbom.dependencies.some((dependency) => dependency.ref === component['bom-ref'])
  ) {
    sbom.dependencies.push({ ref: component['bom-ref'], dependsOn: [] });
  }

  return sbom;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function buildNpmSbomArguments({ omitDev }) {
  return [
    'sbom',
    '--sbom-format',
    'cyclonedx',
    '--package-lock-only',
    ...(omitDev ? ['--omit', 'dev'] : []),
  ];
}

function packagePathProperty(component) {
  return component.properties?.find(
    (property) => property.name === 'cdx:npm:package:path',
  )?.value;
}

function resolvePhysicalDependencyPath(packagePath, dependencyName, referencesByPath) {
  let currentPath = packagePath;

  while (true) {
    const candidate = currentPath
      ? `${currentPath}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (referencesByPath.has(candidate)) return candidate;
    if (!currentPath) return null;

    const parentPath = path.posix.dirname(currentPath);
    currentPath = parentPath === '.' ? '' : parentPath;
  }
}

function normalizeCycloneDxReferences(sbom, lockfile, { omitDev }) {
  const rootReference = sbom.metadata?.component?.['bom-ref'];
  if (typeof rootReference !== 'string' || rootReference.length === 0) {
    throw new Error('CYCLONEDX_INVALID_ROOT_REFERENCE');
  }
  const rootPackage = lockfile.packages?.[''];
  if (typeof rootPackage?.name === 'string' && rootPackage.name.length > 0) {
    sbom.metadata.component.name = rootPackage.name;
  }
  if (typeof rootPackage?.version === 'string' && rootPackage.version.length > 0) {
    sbom.metadata.component.version = rootPackage.version;
  }

  const referencesByPath = new Map([['', rootReference]]);
  for (const component of sbom.components || []) {
    const packagePath = packagePathProperty(component);
    if (typeof packagePath !== 'string' || packagePath.length === 0) {
      throw new Error(`CYCLONEDX_MISSING_PACKAGE_PATH:${component?.['bom-ref']}`);
    }
    if (referencesByPath.has(packagePath)) {
      throw new Error(`CYCLONEDX_DUPLICATE_PACKAGE_PATH:${packagePath}`);
    }

    const originalReference = component['bom-ref'];
    if (typeof originalReference !== 'string' || originalReference.length === 0) {
      throw new Error('CYCLONEDX_INVALID_REFERENCE');
    }
    const physicalReference = `${originalReference}#npm-path=${encodeURIComponent(packagePath)}`;
    component['bom-ref'] = physicalReference;
    referencesByPath.set(packagePath, physicalReference);
  }

  const dependencies = [];
  for (const [packagePath, reference] of referencesByPath) {
    const lockPackage = lockfile.packages?.[packagePath];
    if (!lockPackage) {
      throw new Error(`PACKAGE_LOCK_MISSING_PATH:${packagePath || '<root>'}`);
    }

    const dependencyNames = new Set([
      ...Object.keys(lockPackage.dependencies || {}),
      ...Object.keys(lockPackage.optionalDependencies || {}),
      ...Object.keys(lockPackage.peerDependencies || {}),
      ...(!omitDev && packagePath === ''
        ? Object.keys(lockPackage.devDependencies || {})
        : []),
    ]);
    const dependsOn = [];
    for (const dependencyName of dependencyNames) {
      const resolvedPath = resolvePhysicalDependencyPath(
        packagePath,
        dependencyName,
        referencesByPath,
      );
      if (resolvedPath) dependsOn.push(referencesByPath.get(resolvedPath));
    }

    dependencies.push({
      ref: reference,
      dependsOn: [...new Set(dependsOn)].sort(),
    });
  }

  sbom.dependencies = dependencies.sort((left, right) =>
    left.ref.localeCompare(right.ref),
  );
  return sbom;
}

function makeCycloneDxReproducible(sbom) {
  delete sbom.serialNumber;
  if (sbom.metadata) delete sbom.metadata.timestamp;
  if (Array.isArray(sbom.components)) {
    sbom.components.sort((left, right) =>
      left['bom-ref'].localeCompare(right['bom-ref']),
    );
  }
  if (Array.isArray(sbom.dependencies)) {
    sbom.dependencies.sort((left, right) => left.ref.localeCompare(right.ref));
  }
  return sbom;
}

function validateCycloneDxGraph(sbom) {
  if (
    sbom?.bomFormat !== 'CycloneDX'
    || typeof sbom.specVersion !== 'string'
    || sbom.version !== 1
    || typeof sbom.metadata?.component?.['bom-ref'] !== 'string'
    || !Array.isArray(sbom.components)
    || !Array.isArray(sbom.dependencies)
  ) {
    throw new Error('CYCLONEDX_INVALID_DOCUMENT');
  }

  const references = [
    sbom.metadata.component['bom-ref'],
    ...sbom.components.map((component) => component?.['bom-ref']),
  ];
  const referenceSet = new Set();
  for (const reference of references) {
    if (typeof reference !== 'string' || reference.length === 0) {
      throw new Error('CYCLONEDX_INVALID_REFERENCE');
    }
    if (referenceSet.has(reference)) {
      throw new Error(`CYCLONEDX_DUPLICATE_REFERENCE:${reference}`);
    }
    referenceSet.add(reference);
  }

  for (const dependency of sbom.dependencies) {
    if (!referenceSet.has(dependency?.ref)) {
      throw new Error(`CYCLONEDX_DANGLING_REFERENCE:${dependency?.ref}`);
    }
    if (!Array.isArray(dependency.dependsOn)) {
      throw new Error(`CYCLONEDX_INVALID_DEPENDENCY:${dependency.ref}`);
    }
    for (const reference of dependency.dependsOn) {
      if (!referenceSet.has(reference)) {
        throw new Error(`CYCLONEDX_DANGLING_REFERENCE:${reference}`);
      }
    }
  }

  return sbom;
}

async function main() {
  const omitDev = !process.argv.includes('--include-dev');
  const outputPath = path.resolve(
    projectRoot,
    argument(
      '--output',
      omitDev ? 'security/sbom/runtime.cdx.json' : 'security/sbom/full.cdx.json',
    ),
  );
  const exceptions = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'security/npm-tree-exceptions.json'), 'utf8'),
  );
  const exception = exceptions.exceptions.find((candidate) =>
    candidate.type === 'extraneous' && candidate.name === '@emnapi/runtime',
  );
  if (!exception) throw new Error('Missing controlled @emnapi/runtime exception');

  const physicalPackagePath = path.join(
    projectRoot,
    'node_modules/@emnapi/runtime/package.json',
  );
  if (!fs.existsSync(physicalPackagePath)) {
    throw new Error('Expected physical @emnapi/runtime package is absent');
  }
  const physicalPackage = JSON.parse(fs.readFileSync(physicalPackagePath, 'utf8'));
  if (physicalPackage.version !== exception.version) {
    throw new Error(
      `Physical @emnapi/runtime version ${physicalPackage.version} does not match ${exception.version}`,
    );
  }

  const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  const lockPackage = lock.packages?.['node_modules/@emnapi/runtime'];
  if (!lockPackage?.integrity) {
    throw new Error('package-lock entry for @emnapi/runtime has no integrity hash');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const generated = spawnSync(
    npmExecutable,
    buildNpmSbomArguments({ omitDev }),
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (generated.status !== 0) {
    process.stderr.write(generated.stdout || '');
    process.stderr.write(generated.stderr || '');
    throw new Error(`npm sbom exited with ${generated.status}`);
  }

  const sbom = normalizeCycloneDxReferences(
    JSON.parse(generated.stdout),
    lock,
    { omitDev },
  );
  augmentWithPhysicalException(sbom, {
    packageJson: physicalPackage,
    lockPackage,
    exception,
  });
  makeCycloneDxReproducible(sbom);
  validateCycloneDxGraph(sbom);
  const serialized = `${JSON.stringify(sbom, null, 2)}\n`;
  fs.writeFileSync(outputPath, serialized);
  process.stdout.write(`${JSON.stringify({
    output: outputPath,
    format: `${sbom.bomFormat} ${sbom.specVersion}`,
    components: sbom.components?.length || 0,
    physicalExceptionIncluded: sbom.components?.some((component) =>
      component.purl === exceptionComponentPurl,
    ),
  }, null, 2)}\n`);
}

module.exports = {
  augmentWithPhysicalException,
  buildNpmSbomArguments,
  makeCycloneDxReproducible,
  normalizeCycloneDxReferences,
  sriToCycloneDxHash,
  validateCycloneDxGraph,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}
