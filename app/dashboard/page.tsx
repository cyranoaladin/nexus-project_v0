import { getRoleDestination } from '@/lib/auth/role-destinations';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  redirect(getRoleDestination(session.user.role) ?? '/auth/signin');
}
