'use client';

/**
 * Global error boundary — catches errors in the root layout itself.
 * Must provide its own <html>/<body> since the root layout may have crashed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="bg-[#071A3A] text-[#F7F4ED] font-sans antialiased">
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, serif' }}>
              Erreur critique
            </h1>
            <p className="mt-3 text-base" style={{ color: '#C4BBA8' }}>
              Une erreur inattendue s&apos;est produite. Veuillez recharger la page.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs" style={{ color: '#97918A' }}>
                Référence : {error.digest}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="rounded-lg px-6 py-3 text-sm font-semibold transition min-h-[44px]"
                style={{ backgroundColor: '#BFA06A', color: '#071A3A' }}
              >
                Recharger la page
              </button>
              <a
                href="/"
                className="rounded-lg border px-6 py-3 text-sm font-semibold transition min-h-[44px]"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              >
                Retour à l&apos;accueil
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
