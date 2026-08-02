import { readFileSync } from 'node:fs';

const CLIENT_BOUNDARY = [
  'app/api/bilans/attempts/[id]/route.ts',
];

describe('frontière anti-divulgation du questionnaire Canonical', () => {
  test('the client boundary contains neither answer sentinels nor direct pack imports', () => {
    const bundleInputs = CLIENT_BOUNDARY.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(bundleInputs).not.toMatch(/__CORRECT__|__RATIONALE__/);
    expect(bundleInputs).not.toMatch(/data\/bilans\/banks|loadBilanPack|loadValidatedPack/);
  });
});
