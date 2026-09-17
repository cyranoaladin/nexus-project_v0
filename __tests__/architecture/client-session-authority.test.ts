import { readdirSync, readFileSync } from 'node:fs';
import { clientSessionAuthorityViolations as violations } from './helpers/client-session-authority-guard';
import inventory from '@/docs/audits/auth-session-convergence-inventory.json';
import { isProtectedSessionPath } from '@/components/auth/SessionRecoveryProvider';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(path);
    return /\.[cm]?[jt]sx?$/.test(path) && !/\.(test|spec)\.[jt]sx?$/.test(path) ? [path] : [];
  });
}

describe('one client session observation authority', () => {
  it.each([
    `import {useSession} from 'next-auth/react';`,
    `import {useSession as harmless} from 'next-auth/react';`,
    `import * as auth from 'next-auth/react'; auth['useSession']();`,
    `import auth from 'next-auth/react';`,
    `export {useSession as display} from 'next-auth/react';`,
    `export * from 'next-auth/react';`,
    `const auth = require('next-auth/react');`,
    `const auth = await import('next-auth/react');`,
    `const auth = require('next-auth/' + 'react');`,
    `const source = 'next-auth/react'; const auth = await import(source);`,
    `const source = 'next-auth/' + 'react'; const auth = globalThis.require(source);`,
    `import {SessionContext} from 'next-auth/react';`,
  ])('rejects raw authority access regardless of local spelling: %s', source => {
    expect(violations('app/dashboard/eleve/page.tsx', source)).not.toEqual([]);
  });
  it('allows server guards, navigation links, local names and type-only imports', () => {
    expect(violations('app/dashboard/layout.tsx', `import {auth} from '@/auth';
      import type { SessionContextValue } from 'next-auth/react';
      function useSession() {};
      if (!await auth()) redirect('/auth/signin');`)).toEqual([]);
  });
  it('allows the shared owner but not another owner with the same basename', () => {
    const source = `import { useSession, getSession, signOut } from 'next-auth/react';`;
    expect(violations('components/auth/SessionRecoveryProvider.tsx', source)).toEqual([]);
    expect(violations('components/aria/SessionRecoveryProvider.tsx', source)).not.toEqual([]);
  });
  it('rejects another canonical-session transport outside the two shared-controller projections', () => {
    expect(violations('app/dashboard/eleve/page.tsx', `fetch('/api/auth/' + 'session')`)).not.toEqual([]);
    expect(violations('components/auth/SessionRecoveryProvider.tsx', `fetch('/api/auth/session')`)).toEqual([]);
    expect(violations('lib/auth/static-session-recovery.ts', `fetch('/api/auth/session')`)).toEqual([]);
  });
  it.each([
    "fetch('/api/auth/session?refresh=1').then(r => r.json()).then(s => { if (!s) router.push('/auth/signin'); });",
    "fetch(`/api/auth/${'session'}`).catch(() => router.push('/auth/signin'));",
    "fetch(new URL('/api/auth/session', location.origin));",
  ])('rejects alternate spellings of the canonical session transport: %s', source => {
    expect(violations('app/dashboard/eleve/page.tsx', source)).not.toEqual([]);
  });
  it.each([
    "const { data } = useSession(); if (!data) router.push('/auth/signin');",
    "const { data: session, status } = useSession(); if (session === null) router.replace('/auth/signin');",
    "const { data, status } = useSession(); if (status === 'loading') console.log('waiting'); if (!data) router.push('/auth/signin');",
    "const { data, status } = useSession(); if (data === null || status === 'unauthenticated') router.push('/auth/signin');",
  ])('rejects local canonical-null decisions before positive confirmation: %s', body => {
    expect(violations('app/dashboard/eleve/page.tsx', `import { useCanonicalSession as useSession } from '@/components/auth/SessionRecoveryProvider'; function Page() { ${body} }`)).not.toEqual([]);
  });
  it.each([
    "const session = useCanonicalSession(); if (!session.data) router.push('/auth/signin');",
    "if (!useCanonicalSession().data) router.replace('/auth/signin');",
    "const { data } = useCanonicalSession(); data === null && router.push('/auth/signin');",
    "const session = useCanonicalSession(); const alias = session; if (alias.data === null) router.replace('/auth/signin');",
    "const session = useCanonicalSession(); const data = session.data; !data && router.push('/auth/signin');",
    "const session = useCanonicalSession(); const { data: userSession } = session; if (!userSession) router.replace('/auth/signin');",
    "const session = useCanonicalSession(); session['data'] === null && router.push('/auth/signin');",
    "const session = useCanonicalSession(); if (session.status === 'loading') console.log('waiting'); !session.data && router.push('/auth/signin');",
    "const session = useCanonicalSession(); (session.status === 'unauthenticated' || !session.data) && router.push('/auth/signin');",
  ])('rejects member and logical-expression bypasses: %s', body => {
    expect(violations('app/dashboard/eleve/page.tsx', `import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider'; function Page() { ${body} }`)).not.toEqual([]);
  });
  it.each([
    "const session = useCanonicalSession(); if (session.status === 'loading') return null; if (!session.data) router.push('/auth/signin');",
    "const session = useCanonicalSession(); if (session.status === 'unauthenticated') router.push('/auth/signin');",
    "const session = useCanonicalSession(); session.status !== 'loading' && !session.data && router.replace('/auth/signin');",
    "const session = useCanonicalSession(); const data = session.data; const status = session.status; if (status === 'loading') return; !data && router.push('/auth/signin');",
    "const session = useCanonicalSession(); const { data, status } = session; (status !== 'loading' && data === null) && router.push('/auth/signin');",
    "const session = useCanonicalSession(); if (session.status !== 'loading') { !session.data && router.push('/auth/signin'); }",
  ])('allows confirmed canonical member and alias decisions: %s', body => {
    expect(violations('app/dashboard/eleve/page.tsx', `import { useCanonicalSession } from '@/components/auth/SessionRecoveryProvider'; function Page() { ${body} }`)).toEqual([]);
  });
  it.each([
    "if (status === 'loading') return null; if (!data) router.push('/auth/signin');",
    "if (status === 'unauthenticated') router.replace('/auth/signin');",
    "if (status !== 'loading' && !data) router.push('/auth/signin');",
    "if (status === 'loading') { return <Loading />; } if (!data || data.user.role !== 'ELEVE') router.push('/auth/signin');",
  ])('preserves confirmed canonical absence and existing role decisions: %s', body => {
    expect(violations('app/dashboard/eleve/page.tsx', `import { useCanonicalSession as useSession } from '@/components/auth/SessionRecoveryProvider'; function Page() { const { data, status } = useSession(); ${body} }`)).toEqual([]);
  });
  it('checks the authored static Planning runtime for a second session transport', () => {
    expect(violations('tools/planning-studio/assets/app.js', "fetch('/api/auth/session?refresh=1');")).not.toEqual([]);
    const problems = files('tools/planning-studio/assets').flatMap(path => violations(path, readFileSync(path, 'utf8')));
    expect(problems).toEqual([]);
  });
  it('inventories every protected page and the separately generated static document', () => {
    const pages = files('app').filter(path => /\/page\.[jt]sx?$/.test(path)).filter(path => {
      const route = path.replace(/^app/, '').replace(/\/page\.[jt]sx?$/, '');
      return isProtectedSessionPath(route) || route === '/programme/maths-1ere-stmg';
    }).sort();
    const listed = inventory.modules.filter(item => item.MODULE_KIND === 'NEXT_PAGE').map(item => item.PATH).sort();
    expect(listed).toEqual(pages);
    expect(new Set(inventory.modules.map(item => item.PATH)).size).toBe(inventory.modules.length);
    for (const item of inventory.modules) {
      expect(item.CANONICAL_GUARD_MIGRATED).toBe(true);
      expect(item.CURRENT_RAW_NULL_BEHAVIOR).toBe('NONE_SHARED_CANONICAL_OBSERVATION');
      expect(item.ROLE.length).toBeGreaterThan(0);
      expect(JSON.stringify(item)).not.toContain('UNKNOWN');
      expect(typeof item.DRAFT_STATE_PRESENT).toBe('boolean');
      expect(typeof item.MUTATING_ACTIONS_PRESENT).toBe('boolean');
    }
    expect(inventory.modules.filter(item => item.MODULE_KIND === 'STATIC_DOCUMENT').map(item => item.PATH)).toEqual(['public/planning/index.html']);
  });
  it('has no raw client authority outside the canonical owner in any runtime module', () => {
    const problems = ['app', 'components', 'hooks', 'lib', 'context', 'tools/planning-studio/assets'].flatMap(files)
      .flatMap(path => violations(path, readFileSync(path, 'utf8')));
    expect(problems).toEqual([]);
  });
});
