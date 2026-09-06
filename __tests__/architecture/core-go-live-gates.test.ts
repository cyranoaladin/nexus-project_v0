import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
it('documents independent core and RAG gates without declaring readiness prematurely', () => {
 const gates = read('CORE_GO_LIVE_GATE.md');
 expect(gates).toContain('CORE_PLATFORM_GO_LIVE_READY');
 expect(gates).toContain('RAG_FEATURE_GO_LIVE_READY');
 expect(gates).toContain('External RAG staging: NON_BLOCKING_CORE / BLOCKING_RAG_FEATURE');
 expect(gates).toContain('CORE_PLATFORM_GO_LIVE_READY = NOT_YET_VERIFIED');
 expect(gates).toContain('RAG_FEATURE_GO_LIVE_READY = BLOCKED');
 expect(read('audit_dsahboard.md')).toContain('CORE_GO_LIVE_GATE.md');
 expect(read('docs/audits/2026-09-06-core-platform-go-live.md')).toContain('95f518e31');
});
it('all five active destination consumers import the canonical map, without duplicating destinations', () => {
 for (const path of ['auth.config.ts', 'middleware.ts', 'app/dashboard/page.tsx', 'app/auth/signin/SignInForm.tsx', 'app/access-required/page.tsx']) {
  const content = read(path);
  expect(content).toContain('@/lib/auth/role-destinations');
  expect(content).not.toMatch(/(?:ADMIN|ASSISTANTE|COACH|PARENT|ELEVE):\s*['"]\/dashboard\//);
 }
});

it('uses the same safe login fallback in landing and UI consumers', () => {
 for (const path of ['app/dashboard/page.tsx', 'app/auth/signin/SignInForm.tsx', 'app/access-required/page.tsx']) {
  expect(read(path)).toContain("'/auth/signin'");
  expect(read(path)).not.toMatch(/\?\? ['"]\/dashboard(?:\/parent)?['"]/);
 }
});
