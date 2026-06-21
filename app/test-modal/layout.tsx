import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Guard: /test-modal returns 404 unless ALLOW_TEST_ROUTES=1.
 * Playwright sets this env var; production never does → 404 in prod.
 */
export default function TestModalLayout({ children }: { children: React.ReactNode }) {
  if (process.env.ALLOW_TEST_ROUTES !== '1') {
    notFound();
  }
  return <>{children}</>;
}
