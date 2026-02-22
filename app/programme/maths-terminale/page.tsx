import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { MathJaxProvider } from '../maths-1ere/components/MathJaxProvider';
import MathsTerminaleClient from './components/MathsTerminaleClient';

export default async function MathsTerminalePage() {
  const callbackUrl = '/programme/maths-terminale';
  const session = await auth();
  const sessionUser = session?.user as { id?: string; firstName?: string; name?: string } | undefined;

  if (!sessionUser?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const userId = sessionUser.id;
  const displayName = sessionUser.firstName?.trim() || sessionUser.name?.split(' ')[0] || 'Élève';

  return (
    <MathJaxProvider>
      <MathsTerminaleClient userId={userId} initialDisplayName={displayName} />
    </MathJaxProvider>
  );
}
