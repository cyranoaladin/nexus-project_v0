'use client';

import { Button } from '@/components/ui/button';

export function SessionVerificationUnavailable({ retry }: { retry: () => void }) {
  return <div role="status" className="min-h-screen flex items-center justify-center bg-surface-darker text-neutral-100">
    <div className="space-y-4 p-6 text-center">
      <p>La vérification de votre session est momentanément indisponible.</p>
      <Button onClick={retry}>Réessayer</Button>
    </div>
  </div>;
}
