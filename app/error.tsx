'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-lux-ink px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        </div>

        <h1 className="font-fraunces text-3xl font-light text-lux-ivory">
          Oups ! Une erreur s&apos;est produite
        </h1>
        <p className="mt-3 text-base text-lux-on-dark-muted">
          Quelque chose s&apos;est mal passé. Veuillez réessayer ou revenir à l&apos;accueil.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-lux-on-dark-subtle">
            Référence : {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink transition hover:bg-lux-gold-bright min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4" />
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-lux-line/40 bg-white/5 px-6 py-3 text-sm font-semibold text-lux-ivory transition hover:bg-white/10 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </div>

        <p className="mt-6 text-xs text-lux-on-dark-subtle">
          Si le problème persiste, veuillez{' '}
          <Link href="/contact" className="text-lux-gold underline">
            contacter le support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
