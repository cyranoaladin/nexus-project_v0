"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-eleve]", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-8 shadow-xl">
        <div className="mb-4 text-4xl" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-amber-100">
          Le tableau de bord est temporairement indisponible
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-50/70">
          Une erreur s&apos;est produite lors du chargement. Vos données et votre progression sont sécurisées.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-semibold text-surface-darker transition hover:bg-amber-300"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-semibold text-neutral-200 no-underline transition hover:bg-white/5"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-neutral-500" aria-label="Code de référence erreur">
            Référence : {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
