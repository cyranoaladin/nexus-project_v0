import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import FacturationPage from '@/app/dashboard/admin/facturation/page';
import { UserRole } from '@prisma/client';

export default async function AssistanteFacturationPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user?.id || (role !== UserRole.ASSISTANTE && role !== UserRole.ADMIN)) {
    redirect('/auth/signin');
  }

  return <FacturationPage />;
}
