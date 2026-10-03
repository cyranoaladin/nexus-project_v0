import type { Metadata } from 'next';

import { CredentialForm } from '@/components/espace/shared/CredentialForm';
import { CREDENTIAL_PAGE_TEACHER, requireActorForPage } from '@/lib/espace/page-guard';

export const metadata: Metadata = { title: 'Mon compte' };
export const dynamic = 'force-dynamic';

export default async function TeacherAccountPage() {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], CREDENTIAL_PAGE_TEACHER);
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">Mon compte</h1>
        <p className="mt-1 text-sm text-neutral-300">{[actor.firstName, actor.lastName].filter(Boolean).join(' ')}</p>
      </div>
      <section aria-labelledby="h-securite">
        <h2 id="h-securite" className="mb-3 text-lg font-semibold text-neutral-50">Sécurité — modifier mon mot de passe</h2>
        <CredentialForm kind="password" />
        <p className="mt-4 text-sm text-neutral-400">
          Ce mot de passe est aussi celui de votre connexion par adresse e-mail. Après le changement, toutes vos sessions sont fermées.
        </p>
      </section>
    </div>
  );
}
