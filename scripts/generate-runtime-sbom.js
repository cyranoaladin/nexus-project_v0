#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
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

  return sbom;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const outputPath = path.resolve(
    projectRoot,
    argument('--output', 'security/sbom/runtime.cdx.json'),
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
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sbom-'));
  const generatedPath = path.join(temporaryDirectory, 'runtime.cdx.json');
  const cli = path.join(projectRoot, 'node_modules/.bin/cyclonedx-npm');
  const generated = spawnSync(cli, [
    '--omit', 'dev',
    '--output-reproducible',
    '--spec-version', '1.6',
    '--validate',
    '--output-file', generatedPath,
    path.join(projectRoot, 'package.json'),
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (generated.status !== 0) {
    process.stderr.write(generated.stdout || '');
    process.stderr.write(generated.stderr || '');
    throw new Error(`cyclonedx-npm exited with ${generated.status}`);
  }

  const sbom = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
  augmentWithPhysicalException(sbom, {
    packageJson: physicalPackage,
    lockPackage,
    exception,
  });
  const serialized = `${JSON.stringify(sbom, null, 2)}\n`;
  const { Spec, Validation } = require(path.join(
    projectRoot,
    'node_modules/@cyclonedx/cyclonedx-npm/node_modules/@cyclonedx/cyclonedx-library',
  ));
  const validationError = await new Validation.JsonValidator(
    Spec.Version.v1dot6,
  ).validate(serialized);
  if (validationError) {
    throw new Error(`Augmented CycloneDX document is invalid: ${JSON.stringify(validationError)}`);
  }
  fs.writeFileSync(outputPath, serialized);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  process.stdout.write(`${JSON.stringify({
    output: outputPath,
    format: `${sbom.bomFormat} ${sbom.specVersion}`,
    components: sbom.components?.length || 0,
    physicalExceptionIncluded: sbom.components?.some((component) =>
      component.purl === exceptionComponentPurl,
    ),
  }, null, 2)}\n`);
}

module.exports = { augmentWithPhysicalException, sriToCycloneDxHash };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}
