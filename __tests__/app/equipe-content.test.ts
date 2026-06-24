import fs from 'node:fs';
import path from 'node:path';

const equipeSource = fs.readFileSync(
  path.join(process.cwd(), 'app/equipe/page.tsx'),
  'utf8',
);

describe('/equipe trust content guardrails', () => {
  test('does not expose fabricated testimonials or ratings', () => {
    expect(equipeSource).not.toMatch(/\btestimonial\b/i);
    expect(equipeSource).not.toMatch(/\brating\b/i);
  });

  test('does not present fictive individual identities as real mentors', () => {
    const fictiveNames = [
      'Marc',
      'Sophie',
      'Yassine',
      'Hélène',
      'Alexandre',
      'Victor',
      'Fabien',
      'Olivier',
      'Rachid',
      'Karim',
      'Sarah',
      'Pierre',
      'Clara',
    ];

    for (const name of fictiveNames) {
      expect(equipeSource).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  test('does not keep aggressive comparative ROI copy', () => {
    expect(equipeSource).not.toContain('MEILLEUR ROI');
    expect(equipeSource).not.toContain('2×');
    expect(equipeSource).not.toMatch(/professeur classique/i);
  });

  test('does not render escaped UTF-8 sequences as JSX text', () => {
    expect(equipeSource).not.toMatch(/\\u00/i);
  });
});
