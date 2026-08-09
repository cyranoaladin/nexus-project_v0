import { Plus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ParentChildrenEmptyState({ onAddChild }: Readonly<{ onAddChild: () => void }>) {
  return (
    <section className="rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-6 text-center">
      <Users className="mx-auto h-9 w-9 text-brand-accent" aria-hidden="true" />
      <h3 className="mt-3 text-lg font-semibold text-white">Commencez le bilan de votre enfant</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-300">
        Ajoutez votre enfant, puis remettez-lui son lien personnel pour qu’il active son compte et passe son bilan.
      </p>
      <Button type="button" className="mt-5 bg-brand-accent text-surface-darker" onClick={onAddChild}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Ajouter votre enfant
      </Button>
    </section>
  );
}
