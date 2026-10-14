import { Suspense } from 'react';
import { CoreWorkspace } from '@/components/dashboard/core-v2/CoreWorkspace';
import { getOrganizationTimezone } from '@/lib/timezone';
export const dynamic = 'force-dynamic';
export default async function CoreWorkspacePage({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view = [] } = await params;
  return <Suspense fallback={<p role="status">Chargement…</p>}><CoreWorkspace view={view} organizationTimezone={getOrganizationTimezone()} /></Suspense>;
}
