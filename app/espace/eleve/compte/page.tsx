import type { Metadata } from 'next';

import { CredentialForm } from '@/components/espace/shared/CredentialForm';
import { CREDENTIAL_PAGE_STUDENT, requireActorForPage } from '@/lib/espace/page-guard';

export const metadata: Metadata = { title: 'Mon compte' };
export const dynamic = 'force-dynamic';

export default async function StudentAccountPage() {
  // Seule page accessible avec un code temporaire : l'élève y choisit son propre code.
  const actor = await requireActorForPage(['ELEVE'], CREDENTIAL_PAGE_STUDENT, { allowTemporaryCode: true });
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">Mon compte</h1>
        <p className="mt-1 text-sm text-neutral-300">{[actor.firstName, actor.lastName].filter(Boolean).join(' ')}</p>
      </div>
      <section aria-labelledby="h-securite">
        <h2 id="h-securite" className="mb-3 text-lg font-semibold text-neutral-50">Sécurité — modifier mon code personnel</h2>
        <CredentialForm kind="code" mandatory={actor.mustChangeCredential === true} />
        <p className="mt-4 text-sm text-neutral-400">
          Ton code est secret : personne, pas même ton enseignant, ne peut le lire. Si tu l’oublies, ton enseignant peut t’en donner un nouveau, temporaire.
        </p>
      </section>
    </div>
  );
}
