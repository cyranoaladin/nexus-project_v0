import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { NexusInvoiceGenerator } from '@/components/facturation/NexusInvoiceGenerator';
import { UserRole } from '@prisma/client';

export default async function AssistanteFacturationPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user || (role !== UserRole.ASSISTANTE && role !== UserRole.ADMIN)) {
    redirect('/auth/signin');
  }

  return <NexusInvoiceGenerator />;
}
