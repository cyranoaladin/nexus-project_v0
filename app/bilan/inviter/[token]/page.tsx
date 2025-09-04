import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyStudentInviteToken } from '@/lib/invite';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InviteActivationPage({ params, searchParams }: { params: { token: string }; searchParams: Record<string, string | string[] | undefined>; }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const token = decodeURIComponent(params.token);
  const payload = verifyStudentInviteToken(token);
  if (!payload) {
    redirect('/auth/signin');
  }

  // Si déjà connecté en tant qu'élève cible → envoyer vers le wizard
  if (session?.user?.id === payload.studentUserId) {
    redirect('/bilan-gratuit/wizard');
  }

  // Sinon, connecter le compte élève cible par redirection vers signin avec callback
  const callbackUrl = encodeURIComponent('/bilan-gratuit/wizard');
  const signinUrl = `/auth/signin?email=${encodeURIComponent(payload.studentEmail)}&callbackUrl=${callbackUrl}`;
  redirect(signinUrl);
}


