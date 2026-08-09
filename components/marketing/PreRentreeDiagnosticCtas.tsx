import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';

const DIAGNOSTIC_PATH = '/bilan-gratuit?parcours=diagnostic#demande-bilan';
const ADVISER_PATH = '/bilan-gratuit?parcours=conseiller#rappel-conseiller';

export function PreRentreeDiagnosticCtas({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <div className={`flex flex-col items-stretch gap-3 sm:flex-row sm:items-center ${className}`.trim()}>
      <Link
        href={DIAGNOSTIC_PATH}
        className="lux-cta-reserve inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-semibold"
      >
        Passer le bilan de pré-rentrée
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        href={ADVISER_PATH}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-gold/60 px-6 py-3 text-center text-sm font-semibold text-lux-gold-wash transition-colors hover:bg-lux-gold/10"
      >
        <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
        Être rappelé par un conseiller
      </Link>
    </div>
  );
}
