import { createHash } from 'node:crypto';

const { augmentWithPhysicalException } = require('../../scripts/generate-runtime-sbom.js');

describe('runtime SBOM policy augmentation', () => {
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
        expiresOn: '2026-09-30',
      },
    });

    expect(result.components).toHaveLength(1);
  });
});
