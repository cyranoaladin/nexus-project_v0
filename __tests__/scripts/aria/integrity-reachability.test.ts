import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  inspectAriaIntegrity,
  renderAriaIntegrityReport,
} from '@/scripts/aria/check-integrity';
import {
  inspectAriaReachability,
  renderAriaReachabilityReport,
} from '@/scripts/aria/check-reachability';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-architecture-'));
}

function write(root: string, path: string, value: string): void {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, value);
}

function integritySkeleton(root: string): void {
  for (const directory of ['app/api/aria', 'components/aria', 'lib/aria/transport']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  write(root, 'app/api/aria/conversations/route.ts', 'export const context = "courseKey";');
  write(
    root,
    'lib/aria/transport/contracts.ts',
    'export const ariaConversationListQuerySchema = { courseKey: true };',
  );
  write(root, 'components/aria/panel.tsx', 'export const Panel = () => null;');
  write(root, 'lib/aria/core.ts', 'export const core = true;');
}

describe('ARIA integrity operational checker', () => {
  it('accepts a courseKey-only repository and renders all zero-debt metrics', () => {
    const root = fixtureRoot();
    integritySkeleton(root);
    const report = inspectAriaIntegrity(root);
    expect(report).toMatchObject({ historyIsCourseKey: true, violationCount: 0 });
    const output: string[] = [];
    renderAriaIntegrityReport(report, (chunk) => output.push(chunk));
    expect(output.join('')).toContain('LEGACY_ADAPTER_DEFAULT_GRADE=NONE\n');
    expect(output.join('')).toContain('ARIA_HISTORY_PRIMARY_CONTEXT=COURSE_KEY\n');
    expect(output.join('')).toContain('ARIA_HARDCODED_COURSE_LISTS=0\n');
  });

  it('reports every forbidden default, legacy adapter and subject API shape with evidence', () => {
    const root = fixtureRoot();
    integritySkeleton(root);
    write(root, 'components/aria/bad.tsx', [
      "const courseKey = 'eds-maths-premiere';",
      'const selected = available[0];',
      "fetch('/api/aria/chat?subject=MATHS', { body: JSON.stringify({ subject: 'MATHS' }) });",
      'void courseKey; void selected;',
    ].join('\n'));
    write(root, 'lib/aria/legacy.ts', [
      "export function mapLegacySubjectToCourseKey(subject: string, grade = 'TERMINALE') { return subject + grade; }",
      "mapLegacySubjectToCourseKey('MATHS', 'TERMINALE');",
      'export function generateAriaResponse() { return null; }',
      "const fallback = course?.legacySubject || 'MATHEMATIQUES';",
      "const implicit = requested ?? 'eds-nsi-premiere';",
      'void fallback; void implicit;',
    ].join('\n'));
    write(root, 'lib/aria/importer.ts', "import { generateAriaStream } from './legacy'; void generateAriaStream;");
    write(
      root,
      'lib/aria/transport/contracts.ts',
      'export const ariaConversationListQuerySchema = { subject: true };',
    );
    const report = inspectAriaIntegrity(root);
    expect(report.hardcodedCourses).toHaveLength(1);
    expect(report.implicitGradeDefaults).toHaveLength(1);
    expect(report.implicitCourseDefaults).toHaveLength(3);
    expect(report.adapterDefaults).toHaveLength(1);
    expect(report.terminaleCalls).toHaveLength(1);
    expect(report.legacyAdapters.length).toBeGreaterThanOrEqual(4);
    expect(report.subjectClients).toHaveLength(2);
    expect(report.subjectMathsFallbacks).toHaveLength(1);
    expect(report.historyIsCourseKey).toBe(false);
    expect(report.violationCount).toBeGreaterThan(0);
    const output: string[] = [];
    renderAriaIntegrityReport(report, (chunk) => output.push(chunk));
    expect(output.join('')).toContain('ARIA_HARDCODED_COURSE_LISTS_FINDING=components/aria/bad.tsx:1');
    expect(output.join('')).toContain('ARIA_HISTORY_PRIMARY_CONTEXT=INVALID');
  });
});

describe('ARIA runtime reachability operational checker', () => {
  it('follows Next, conventional, package, alias, relative, barrel, dynamic and require edges', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria/nested', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({
      scripts: { aria: 'node scripts/aria/active.js && npx tsx scripts/aria/active.ts' },
    }));
    write(root, 'app/page.tsx', [
      "import '@/lib/aria/core';",
      "export { Panel } from '@/components/aria/panel';",
      "void import('@/components/aria/dynamic');",
    ].join('\n'));
    write(root, 'middleware.ts', "require('./lib/aria/middleware-core');");
    write(root, 'lib/aria/core.ts', "export { nested } from './nested'; import 'external-package';");
    write(root, 'lib/aria/nested/index.ts', "export const nested = require('../core');");
    write(root, 'lib/aria/middleware-core.ts', 'export const middlewareCore = true;');
    write(root, 'components/aria/panel.tsx', 'export const Panel = () => null;');
    write(root, 'components/aria/dynamic.tsx', 'export default function Dynamic() { return null; }');
    write(root, 'scripts/aria/active.ts', "import '../../lib/aria/core';");
    write(root, 'scripts/aria/active.js', 'module.exports = true;');
    write(root, 'lib/aria/dead.ts', 'export const dead = true;');
    write(root, 'components/aria/orphan.tsx', 'export const Orphan = () => null;');
    write(root, 'scripts/aria/zombie.ts', 'export const zombie = true;');

    const report = inspectAriaReachability(root);
    expect(report).toEqual({
      deadCode: ['lib/aria/dead.ts'],
      orphans: ['components/aria/orphan.tsx'],
      zombies: ['scripts/aria/zombie.ts'],
      violationCount: 3,
    });
    const output: string[] = [];
    renderAriaReachabilityReport(report, (chunk) => output.push(chunk));
    expect(output.join('')).toContain('ARIA_DEAD_CODE_FILE=lib/aria/dead.ts');
    expect(output.join('')).toContain('ARIA_ORPHANS=1');
    expect(output.join('')).toContain('ARIA_ZOMBIES=1');
  });

  it('reports zero when every ARIA module is reachable', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: { aria: 'tsx scripts/aria/active.ts' } }));
    write(root, 'app/route.ts', "import '@/components/aria/panel';");
    write(root, 'components/aria/panel.ts', "import '../../lib/aria/core';");
    write(root, 'lib/aria/core.ts', 'export const core = true;');
    write(root, 'scripts/aria/active.ts', "import '../../lib/aria/core';");
    expect(inspectAriaReachability(root)).toMatchObject({ violationCount: 0 });
  });
});
