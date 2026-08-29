const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const govDir = path.join(repoRoot, '.github', 'governance');
const schemasDir = path.join(govDir, 'schemas');

const PAIRS = [
  ['repository-settings.schema.json', 'repository-settings.json'],
  ['main-ruleset.schema.json', 'main-ruleset.json'],
  ['review-policy.schema.json', 'review-policy.json'],
  ['checks-registry.schema.json', 'checks-registry.json'],
];

describe('governance schema validation', () => {
  let validateAgainstSchema;

  beforeAll(async () => {
    ({ validateAgainstSchema } = await import('../../scripts/github/lib/schemas.mjs'));
  });

  test.each(PAIRS)('%s validates %s', (schemaFile, dataFile) => {
    const result = validateAgainstSchema(
      path.join(schemasDir, schemaFile),
      path.join(govDir, dataFile),
    );
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('rejects an extra unknown property (additionalProperties: false)', () => {
    const schema = JSON.parse(
      require('fs').readFileSync(path.join(schemasDir, 'repository-settings.schema.json'), 'utf8'),
    );
    const data = JSON.parse(
      require('fs').readFileSync(path.join(govDir, 'repository-settings.json'), 'utf8'),
    );
    const mutated = { ...data, unexpectedField: 'nope' };

    return import('../../scripts/github/lib/schemas.mjs').then(({ validateDataAgainstSchema }) => {
      const fsSchemaPath = path.join(schemasDir, 'repository-settings.schema.json');
      const result = validateDataAgainstSchema(fsSchemaPath, mutated);
      expect(result.ok).toBe(false);
    });
  });

  test('checks-registry producer union rejects an unknown producer.kind', async () => {
    const { validateDataAgainstSchema } = await import('../../scripts/github/lib/schemas.mjs');
    const data = JSON.parse(
      require('fs').readFileSync(path.join(govDir, 'checks-registry.json'), 'utf8'),
    );
    const mutated = {
      ...data,
      requiredChecks: [
        {
          context: 'Mystery Check',
          producer: { kind: 'SOMETHING_UNMODELED', expectedContext: 'Mystery Check' },
        },
      ],
    };
    const result = validateDataAgainstSchema(path.join(schemasDir, 'checks-registry.schema.json'), mutated);
    expect(result.ok).toBe(false);
  });
});
