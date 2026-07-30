import { createHash } from 'node:crypto';

const {
  augmentWithPhysicalException,
  buildNpmSbomArguments,
  makeCycloneDxReproducible,
  normalizeCycloneDxReferences,
  validateCycloneDxGraph,
} = require('../../scripts/generate-runtime-sbom.js');

describe('runtime SBOM policy augmentation', () => {
  it('uses the native npm CycloneDX generator for the runtime graph', () => {
    expect(buildNpmSbomArguments({ omitDev: true })).toEqual([
      'sbom',
      '--sbom-format',
      'cyclonedx',
      '--package-lock-only',
      '--omit',
      'dev',
    ]);
    expect(buildNpmSbomArguments({ omitDev: false })).toEqual([
      'sbom',
      '--sbom-format',
      'cyclonedx',
      '--package-lock-only',
    ]);
  });

  it('rejects a CycloneDX graph containing duplicate or dangling references', () => {
    const valid = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      version: 1,
      metadata: {
        component: {
          'bom-ref': 'root',
          type: 'application',
          name: 'nexus',
          version: '1.0.0',
        },
      },
      components: [
        {
          'bom-ref': 'dep',
          type: 'library',
          name: 'dep',
          version: '1.0.0',
        },
      ],
      dependencies: [
        { ref: 'root', dependsOn: ['dep'] },
        { ref: 'dep', dependsOn: [] },
      ],
    };

    expect(() => validateCycloneDxGraph(valid)).not.toThrow();
    expect(() => validateCycloneDxGraph({
      ...valid,
      dependencies: [{ ref: 'root', dependsOn: ['missing'] }],
    })).toThrow('CYCLONEDX_DANGLING_REFERENCE:missing');
    expect(() => validateCycloneDxGraph({
      ...valid,
      components: [...valid.components, valid.components[0]],
    })).toThrow('CYCLONEDX_DUPLICATE_REFERENCE:dep');
  });

  it('normalizes duplicate npm references from their physical lockfile paths', () => {
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      version: 1,
      metadata: {
        component: {
          'bom-ref': 'root',
          type: 'application',
          name: 'checkout-directory-name',
          version: '1.0.0',
        },
      },
      components: [
        {
          'bom-ref': 'parent-a@1.0.0',
          type: 'library',
          name: 'parent-a',
          version: '1.0.0',
          properties: [{
            name: 'cdx:npm:package:path',
            value: 'node_modules/parent-a',
          }],
        },
        {
          'bom-ref': 'shared@1.0.0',
          type: 'library',
          name: 'shared',
          version: '1.0.0',
          properties: [{
            name: 'cdx:npm:package:path',
            value: 'node_modules/parent-a/node_modules/shared',
          }],
        },
        {
          'bom-ref': 'parent-b@1.0.0',
          type: 'library',
          name: 'parent-b',
          version: '1.0.0',
          properties: [{
            name: 'cdx:npm:package:path',
            value: 'node_modules/parent-b',
          }],
        },
        {
          'bom-ref': 'shared@1.0.0',
          type: 'library',
          name: 'shared',
          version: '1.0.0',
          properties: [{
            name: 'cdx:npm:package:path',
            value: 'node_modules/parent-b/node_modules/shared',
          }],
        },
      ],
      dependencies: [],
    };
    const lockfile = {
      packages: {
        '': {
          name: 'nexus',
          version: '1.0.0',
          dependencies: {
            'parent-a': '1.0.0',
            'parent-b': '1.0.0',
          },
        },
        'node_modules/parent-a': {
          dependencies: { shared: '1.0.0' },
        },
        'node_modules/parent-a/node_modules/shared': {},
        'node_modules/parent-b': {
          dependencies: { shared: '1.0.0' },
        },
        'node_modules/parent-b/node_modules/shared': {},
      },
    };

    const normalized = normalizeCycloneDxReferences(
      sbom,
      lockfile,
      { omitDev: true },
    );
    const references = normalized.components.map(
      (component: { 'bom-ref': string }) => component['bom-ref'],
    );
    const parentA = normalized.dependencies.find(
      (dependency: { ref: string }) => (
        dependency.ref.includes('node_modules%2Fparent-a')
        && !dependency.ref.includes('shared')
      ),
    );
    const parentB = normalized.dependencies.find(
      (dependency: { ref: string }) => (
        dependency.ref.includes('node_modules%2Fparent-b')
        && !dependency.ref.includes('shared')
      ),
    );

    expect(new Set(references).size).toBe(references.length);
    expect(normalized.metadata.component.name).toBe('nexus');
    expect(parentA.dependsOn).toHaveLength(1);
    expect(parentA.dependsOn[0]).toContain(
      'node_modules%2Fparent-a%2Fnode_modules%2Fshared',
    );
    expect(parentB.dependsOn).toHaveLength(1);
    expect(parentB.dependsOn[0]).toContain(
      'node_modules%2Fparent-b%2Fnode_modules%2Fshared',
    );
    expect(() => validateCycloneDxGraph(normalized)).not.toThrow();
  });

  it('removes run-specific metadata before hashing a generated graph', () => {
    const generated = {
      serialNumber: 'urn:uuid:random',
      metadata: {
        timestamp: '2026-07-30T19:00:00.000Z',
        component: { 'bom-ref': 'root' },
      },
      components: [
        { 'bom-ref': 'z' },
        { 'bom-ref': 'a' },
      ],
    };

    expect(makeCycloneDxReproducible(generated)).toEqual({
      metadata: {
        component: { 'bom-ref': 'root' },
      },
      components: [
        { 'bom-ref': 'a' },
        { 'bom-ref': 'z' },
      ],
    });
  });

  it('adds the physically installed exception with hash, license and artifact ban', () => {
    const bytes = Buffer.from('physical-package');
    const digest = createHash('sha512').update(bytes).digest();
    const integrity = `sha512-${digest.toString('base64')}`;
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      version: 1,
      metadata: { component: { 'bom-ref': 'root', type: 'application', name: 'nexus' } },
      components: [],
      dependencies: [{ ref: 'root', dependsOn: [] }],
    };

    const result = augmentWithPhysicalException(sbom, {
      packageJson: {
        name: '@emnapi/runtime',
        version: '1.11.2',
        license: 'MIT',
      },
      lockPackage: { integrity },
      exception: {
        type: 'extraneous',
        name: '@emnapi/runtime',
        version: '1.11.2',
        artifactAllowed: false,
        upstreamIssue: 'npm/cli#8128',
        owner: 'SECURITY_OWNER',
        approvedOn: '2026-07-23',
        reviewBy: '2026-09-15',
        expiresOn: '2026-09-30',
      },
    });

    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toEqual(expect.objectContaining({
      name: 'runtime',
      group: '@emnapi',
      version: '1.11.2',
      scope: 'optional',
      purl: 'pkg:npm/%40emnapi/runtime@1.11.2',
      hashes: [{
        alg: 'SHA-512',
        content: createHash('sha512').update(bytes).digest('hex').toUpperCase(),
      }],
      licenses: [{ license: { id: 'MIT' } }],
    }));
    expect(result.components[0].properties).toEqual(expect.arrayContaining([
      { name: 'nexus:npm-tree-status', value: 'extraneous' },
      { name: 'nexus:artifact-allowed', value: 'false' },
      { name: 'nexus:exception-owner', value: 'SECURITY_OWNER' },
      { name: 'nexus:exception-approved-on', value: '2026-07-23' },
      { name: 'nexus:exception-review-by', value: '2026-09-15' },
    ]));
    expect(result.annotations[0].text).toContain('must not enter the production artifact');
    expect(result.annotations[0].subjects).toEqual([result.components[0]['bom-ref']]);
  });

  it('does not duplicate a component already emitted by CycloneDX', () => {
    const component = {
      'bom-ref': 'existing',
      type: 'library',
      name: 'runtime',
      group: '@emnapi',
      version: '1.11.2',
      purl: 'pkg:npm/%40emnapi/runtime@1.11.2',
    };
    const sbom = { components: [component] };

    const result = augmentWithPhysicalException(sbom, {
      packageJson: { name: '@emnapi/runtime', version: '1.11.2', license: 'MIT' },
      lockPackage: { integrity: 'sha512-cGh5c2ljYWw=' },
      exception: {
        type: 'extraneous',
        name: '@emnapi/runtime',
        version: '1.11.2',
        artifactAllowed: false,
        owner: 'SECURITY_OWNER',
        approvedOn: '2026-07-23',
        reviewBy: '2026-09-15',
        expiresOn: '2026-09-30',
      },
    });

    expect(result.components).toHaveLength(1);
  });
});
