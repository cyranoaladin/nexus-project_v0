import fs from 'fs';
import path from 'path';

const root = process.cwd();

function filesIn(directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(relative) : [relative];
  });
}

describe('Pré-rentrée landing structural guardrails', () => {
  const componentFiles = filesIn('components/pre-rentree-2026').filter((file) => /\.tsx?$/.test(file));

  it('keeps prices, campaign dates, contact numbers and JSON imports out of components', () => {
    const forbidden = [
      /\b480\b/,
      /\b900\b/,
      /\b1350\b/,
      /\b1800\b/,
      /2026-08-(?:17|28)/,
      /216\d{8}/,
      /pricing\.canonical\.json/,
      /pre-rentree-2026\.json/,
    ];
    const violations = componentFiles.flatMap((file) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      return forbidden.filter((pattern) => pattern.test(source)).map((pattern) => `${file}: ${pattern}`);
    });
    expect(violations).toEqual([]);
  });

  it('keeps approved dates and time slots out of the new schedule component', () => {
    const source = fs.readFileSync(path.join(root, 'components/pre-rentree-2026/ScheduleSection.tsx'), 'utf8');
    expect(source).not.toMatch(/2026-08-(?:17|21|24|28)/);
    expect(source).not.toMatch(/(?:08:30|10:30|10:45|12:45|13:30|15:30|15:45|17:45)/);
    expect(source).not.toMatch(/\b(?:480|900|1350|1800)\b/);
  });

  it('introduces no bypass comments, TODOs or explicit any in campaign code', () => {
    const campaignFiles = [
      ...componentFiles,
      ...filesIn('lib/campaigns/pre-rentree-2026').filter((file) => /\.ts$/.test(file)),
      'app/stages/pre-rentree-2026/page.tsx',
      'app/pre-rentree/page.tsx',
    ];
    const forbidden = /\bTODO\b|\bFIXME\b|:\s*any\b|as\s+any\b|@ts-ignore|eslint-disable|\.skip\(/;
    expect(campaignFiles.filter((file) => forbidden.test(fs.readFileSync(path.join(root, file), 'utf8')))).toEqual([]);
  });

  it('forbids fictitious contact numbers in active public campaign sources', () => {
    const activeFiles = [
      'data/campaigns/pre-rentree-2026.json',
      'content/pre-rentree-2026/modules.json',
      ...componentFiles,
    ];
    const fictitious = /\+?21620123456/;
    expect(activeFiles.filter((file) => fictitious.test(fs.readFileSync(path.join(root, file), 'utf8')))).toEqual([]);
  });
});
