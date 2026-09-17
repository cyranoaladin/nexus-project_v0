import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { AriaWorkshopsAdmin } from '@/components/dashboard/assistante/AriaWorkshopsAdmin';

export default async function AssistanteAriaWorkshopsPage() {
  const session = await auth();
  const role = session?.user?.role;

  // ASSISTANTE-only, matching the API routes' own strict role check below
  // (resolveInteractiveStaffActor) — not widened to ADMIN, to avoid a page
  // that loads for a role whose real mutations would then silently fail.
  if (!session?.user || role !== UserRole.ASSISTANTE) {
    redirect('/auth/signin');
  }

  return <AriaWorkshopsAdmin />;
}
