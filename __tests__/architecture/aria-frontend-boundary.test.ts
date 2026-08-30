import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('H006 ARIA frontend reachability and single-engine boundary', () => {
  it('removes every orphaned or duplicate historical chat component', () => {
    for (const path of [
      'components/ui/aria-chat.tsx',
      'components/ui/aria-widget.tsx',
      'components/ui/aria-feedback.tsx',
      'components/ui/aria-comparison.tsx',
      'components/ui/aria-embedded-chat.tsx',
    ]) expect(existsSync(resolve(root, path))).toBe(false);
  });

  it('keeps one authenticated panel/engine and a thin dashboard launcher', () => {
    expect(source('app/dashboard/eleve/page.tsx')).toMatch(/AriaChatLauncher/);
    expect(source('components/aria/AriaChatLauncher.tsx')).toMatch(/AriaChatPanel/);
    expect(source('components/aria/AriaChatPanel.tsx')).toMatch(/useAriaConversation/);
  });

  it('keeps the public marketing page static with no product API client', () => {
    const marketing = source('app/plateforme-aria/page.tsx');
    expect(marketing).toMatch(/AriaMarketingDemo/);
    expect(marketing).not.toMatch(/\/api\/aria|AriaChatPanel|useAriaConversation/);
  });

  it('contains no authenticated hardcoded course catalog or implicit Maths/grade fallback', () => {
    const authenticated = [
      source('components/aria/AriaChatPanel.tsx'),
      source('components/aria/useAriaConversation.ts'),
      source('components/aria/AriaChatLauncher.tsx'),
      source('lib/aria/client.ts'),
    ].join('\n');
    expect(authenticated).not.toMatch(/eds-maths-(?:terminale|premiere)|TERMINALE.*fallback|COURSE_OPTIONS/);
  });
});
