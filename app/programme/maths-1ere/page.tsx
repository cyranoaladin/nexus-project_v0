import { MathJaxProvider } from './components/MathJaxProvider';
import MathsRevisionClient from './components/MathsRevisionClient';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Spécialité Maths Première - Interactive Revision Page
 *
 * Features:
 * - Dashboard with progress tracking
 * - Interactive course sheets with MathJax rendering
 * - Quiz with instant feedback and score tracking
 *
 * Based on B.O. Éducation Nationale 2025-2026 programme.
 */
export default async function MathsPremierePage() {
  const callbackUrl = '/programme/maths-1ere';

  const session = await auth();
  const sessionUser = session?.user as { id?: string; firstName?: string; name?: string } | undefined;

  if (!sessionUser?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const userId = sessionUser.id;
  const displayName = sessionUser.firstName?.trim() || sessionUser.name?.split(' ')[0] || 'Élève';

  return (
    <MathJaxProvider>
      <MathsRevisionClient userId={userId} initialDisplayName={displayName} />
    </MathJaxProvider>
  );
}
