import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  switch (session.user.role) {
    case 'ELEVE':
      redirect('/dashboard/eleve');
    case 'PARENT':
      redirect('/dashboard/parent');
    case 'COACH':
      redirect('/dashboard/coach');
    case 'ASSISTANTE':
      redirect('/dashboard/assistante');
    case 'ADMIN':
      redirect('/dashboard/admin');
    default:
      redirect('/auth/signin');
  }
}
