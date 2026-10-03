import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';

export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');
  return <section className="rounded-xl bg-white p-6 text-slate-900">
    <h1 className="mb-4 text-2xl font-semibold">Sécurité de mon compte</h1>
    {session.user.authority === 'CORE_V2' ? <PasswordChangeForm /> : <div className="space-y-3">
      <p>Pour changer votre mot de passe, utilisez votre lien personnel de réinitialisation.</p>
      <Link href="/auth/mot-de-passe-oublie" className="underline">Réinitialiser mon mot de passe</Link>
    </div>}
  </section>;
}
