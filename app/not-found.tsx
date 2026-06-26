import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-lux-ink px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lux-line/40 bg-white/5">
          <Search className="h-8 w-8 text-lux-gold" />
        </div>

        <h1 className="font-fraunces text-4xl font-light text-lux-ivory">
          Page introuvable
        </h1>
        <p className="mt-3 text-base text-lux-on-dark-muted">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink transition hover:bg-lux-gold-bright min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 bg-white/5 px-6 py-3 text-sm font-semibold text-lux-ivory transition hover:bg-white/10 min-h-[44px]"
          >
            Contacter Nexus
          </Link>
        </div>
      </div>
    </main>
  );
}
