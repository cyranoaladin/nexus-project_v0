import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';

export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');
  return <section className="rounded-xl bg-white p-6 text-slate-900">
    <h1 className="mb-4 text-2xl font-semibold">Sécurité de mon compte</h1>
    <PasswordChangeForm endpoint={session.user.authority === 'CORE_V2'
      ? '/api/v2/auth/password-change' : '/api/auth/password-change'} />
  </section>;
}
