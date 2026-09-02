import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  inspectAriaIntegrity,
  renderAriaIntegrityReport,
} from '@/scripts/aria/check-integrity';
import {
  inspectAriaReachability,
  renderAriaReachabilityReport,
  runAriaReachabilityCheck,
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

  it('INTEGRITY_REJECTS_HARDCODED_CANONICAL_OPT_COURSE_KEYS', () => {
    const root = fixtureRoot();
    integritySkeleton(root);
    write(root, 'components/aria/opt.tsx', [
      "const course = 'opt-maths-expertes-terminale';",
      "const fallback = requested ?? 'opt-maths-complementaires-terminale';",
      'void course; void fallback;',
    ].join('\n'));
    const report = inspectAriaIntegrity(root);
    expect(report.hardcodedCourses).toHaveLength(2);
    expect(report.implicitCourseDefaults).toHaveLength(1);
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

  it('REACHABILITY_FOLLOWS_PACKAGE_BASH_ENTRYPOINT_AND_STATIC_SHELL_EDGES', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({
      scripts: { aria: 'bash scripts/aria/active.sh' },
    }));
    write(root, 'app/page.tsx', 'export default function Page() { return null; }');
    write(root, 'scripts/aria/active.sh', [
      '#!/usr/bin/env bash',
      'source "$(dirname "$0")/helper.sh"',
      'bash scripts/aria/direct.sh',
    ].join('\n'));
    write(root, 'scripts/aria/helper.sh', '#!/usr/bin/env bash');
    write(root, 'scripts/aria/direct.sh', '#!/usr/bin/env bash');
    write(root, 'scripts/aria/orphan.sh', '#!/usr/bin/env bash');

    expect(inspectAriaReachability(root).zombies).toEqual(['scripts/aria/orphan.sh']);
  });

  it('REACHABILITY_IGNORES_TOOLING_TREES_AND_UNRESOLVED_LOCAL_IMPORTS', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({}));
    write(root, 'app/page.tsx', [
      "import '@/lib/aria/active';",
      "import '@/lib/aria/missing';",
      'export default function Page() { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/active.ts', 'export const active = true;');
    write(root, 'app/node_modules/ignored.ts', "import '@/lib/aria/vendor-node-modules';");
    write(root, 'app/.next/ignored.ts', "import '@/lib/aria/vendor-next';");
    write(root, 'app/.git/ignored.ts', "import '@/lib/aria/vendor-git';");
    write(root, 'lib/aria/vendor-node-modules.ts', 'export const ignored = true;');
    write(root, 'lib/aria/vendor-next.ts', 'export const ignored = true;');
    write(root, 'lib/aria/vendor-git.ts', 'export const ignored = true;');

    expect(inspectAriaReachability(root).deadCode).toEqual([
      'lib/aria/vendor-git.ts',
      'lib/aria/vendor-next.ts',
      'lib/aria/vendor-node-modules.ts',
    ]);
  });

  it('REACHABILITY_RUNNER_REPORTS_BOTH_CLEAN_AND_VIOLATING_GRAPHS', () => {
    const clean = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(clean, directory), { recursive: true });
    }
    write(clean, 'package.json', JSON.stringify({ scripts: {} }));
    write(clean, 'app/page.tsx', "import '@/lib/aria/active'; export default function Page() { return null; }");
    write(clean, 'lib/aria/active.ts', 'export const active = true;');
    const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(clean);

    expect(runAriaReachabilityCheck()).toBe(0);
    cwd.mockRestore();

    write(clean, 'lib/aria/dead.ts', 'export const dead = true;');
    expect(runAriaReachabilityCheck(clean)).toBe(1);
    expect(output).toHaveBeenCalledWith('ARIA_DEAD_CODE=1\n');
    output.mockRestore();
  });

  it('REACHABILITY_DEDUPLICATES_A_DEPENDENCY_DISCOVERED_BY_MULTIPLE_EDGES', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', [
      "import '@/lib/aria/core';",
      "import '../lib/aria/core';",
      'export default function Page() { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/core.ts', 'export const core = true;');

    expect(inspectAriaReachability(root)).toMatchObject({ violationCount: 0 });
  });

  it.each([
    'global-error.tsx',
    'sitemap.ts',
    'robots.ts',
    'manifest.ts',
  ])('REACHABILITY_FOLLOWS_NEXT_%s', (entrypoint) => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, `app/${entrypoint}`, "import '@/lib/aria/core';");
    write(root, 'lib/aria/core.ts', 'export const core = true;');

    expect(inspectAriaReachability(root).deadCode).toEqual([]);
  });

  it('REACHABILITY_REJECTS_SYMLINKED_SOURCE_ENTRY', () => {
    const root = fixtureRoot();
    const outside = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', 'export default function Page() { return null; }');
    write(outside, 'escape.ts', 'export const escaped = true;');
    symlinkSync(join(outside, 'escape.ts'), join(root, 'lib/aria/escape.ts'));

    expect(() => inspectAriaReachability(root)).toThrow(
      'ARIA_REACHABILITY_SOURCE_ENTRY_INVALID:lib/aria/escape.ts',
    );
  });

  it('does not treat a type-only edge as runtime reachability while exempting pure type ports', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', [
      "import type { Mixed } from '@/lib/aria/mixed';",
      "import type { Port } from '@/lib/aria/port';",
      'export default function Page(_props: Mixed & Port) { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/mixed.ts', [
      'export interface Mixed { readonly value?: string }',
      'export const runtimeSideEffect = true;',
    ].join('\n'));
    write(root, 'lib/aria/port.ts', 'export interface Port { readonly port?: string }');

    expect(inspectAriaReachability(root).deadCode).toEqual(['lib/aria/mixed.ts']);
  });

  it('REACHABILITY_PRESERVES_EMPTY_NAMED_IMPORT_AND_EXPORT_SIDE_EFFECTS', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', [
      "import {} from '@/lib/aria/import-side-effect';",
      "export {} from '@/lib/aria/export-side-effect';",
      'export default function Page() { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/import-side-effect.ts', 'globalThis.importSideEffect = true;');
    write(root, 'lib/aria/export-side-effect.ts', 'globalThis.exportSideEffect = true;');

    expect(inspectAriaReachability(root).deadCode).toEqual([]);
  });

  it('REACHABILITY_PRESERVES_RUNTIME_DEFAULT_IMPORT_WITH_TYPE_ONLY_NAMED_SPECIFIERS', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', [
      "import RuntimeDefault, { type Port } from '@/lib/aria/runtime-default';",
      'void RuntimeDefault;',
      'export default function Page(_props: Port) { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/runtime-default.ts', [
      'export interface Port { readonly value?: string }',
      'export default 1;',
    ].join('\n'));

    expect(inspectAriaReachability(root).deadCode).toEqual([]);
  });

  it('REACHABILITY_IGNORES_NONEMPTY_ALL_TYPE_ONLY_NAMED_IMPORT_AND_EXPORT_EDGES', () => {
    const root = fixtureRoot();
    for (const directory of ['app', 'components/aria', 'lib/aria', 'scripts/aria']) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    write(root, 'package.json', JSON.stringify({ scripts: {} }));
    write(root, 'app/page.tsx', [
      "import { type Imported } from '@/lib/aria/imported-runtime';",
      "export { type Exported } from '@/lib/aria/exported-runtime';",
      'export default function Page(_props: Imported) { return null; }',
    ].join('\n'));
    write(root, 'lib/aria/imported-runtime.ts', [
      'export interface Imported { readonly value?: string }',
      'export const runtimeValue = 1;',
    ].join('\n'));
    write(root, 'lib/aria/exported-runtime.ts', [
      'export interface Exported { readonly value?: string }',
      'export const runtimeValue = 1;',
    ].join('\n'));
    write(root, 'lib/aria/type-barrel.ts', [
      "import { type Imported } from './imported-runtime';",
      "export { type Exported } from './exported-runtime';",
      'export interface Local extends Imported { readonly local?: string }',
    ].join('\n'));

    expect(inspectAriaReachability(root).deadCode).toEqual([
      'lib/aria/exported-runtime.ts',
      'lib/aria/imported-runtime.ts',
    ]);
  });
});
