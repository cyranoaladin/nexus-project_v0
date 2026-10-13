import Link from 'next/link';
import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react';

import { fmtPrice } from '@/components/premium/format';
import type { ALaUneCandidatsLibres } from '@/lib/candidats-libres-2027';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const NBSP = ' ';

/**
 * « À la une » de l'accueil : la campagne candidats libres de la session en cours.
 * Les données (prix, échéances, offres encore valables) sont calculées côté serveur.
 */
export function CandidatsLibresALaUne({ aLaUne }: { aLaUne: ALaUneCandidatsLibres }) {
  return (
    <section aria-labelledby="a-la-une-titre" className="border-y border-lux-gold/30 bg-lux-ivory px-4 py-12 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="lux-eyebrow flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lux-gold-deep" aria-hidden="true" />
            À la une · Session {aLaUne.session}
          </p>
          <h2 id="a-la-une-titre" className="mt-3 text-3xl font-fraunces text-lux-ink md:text-4xl">
            Le bac français en candidat libre, le soir et le week-end
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-lux-slate">
            Pour les élèves du lycée tunisien et les candidats non scolarisés{NBSP}: Première, Terminale ou Bac en 1 an, en
            groupes de {aLaUne.groupeMax} au plus, avec l’inscription Cyclades accompagnée.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-lux-ink">
            {aLaUne.echeances.map((e) => (
              <li key={e.niveau} className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 flex-none text-lux-gold-deep" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">{e.niveau}</strong> — {e.texte} (heure de Paris)
                </span>
              </li>
            ))}
            {aLaUne.semaineDiagnostic ? (
              <li className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 flex-none text-lux-gold-deep" aria-hidden="true" />
                <span>{aLaUne.semaineDiagnostic}</span>
              </li>
            ) : null}
          </ul>
          {aLaUne.offre ? <p className="mt-4 text-sm font-semibold text-lux-evergreen">{aLaUne.offre}.</p> : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bac-candidat-libre" className="lux-cta-primary inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold">
              Voir les parcours et les prix
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={buildWhatsAppUrl(`le bac français en candidat libre (session ${aLaUne.session})`)}
              target="_blank"
              rel="noopener noreferrer"
              className="lux-cta-secondary inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Poser une question sur WhatsApp
            </a>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {aLaUne.parcours.map((p) => (
            <li key={p.id}>
              <Link
                href={`/bac-candidat-libre#${p.id}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-lux-line bg-lux-white px-5 py-4 lux-shadow lux-focus"
              >
                <span className="font-fraunces text-lg text-lux-ink">{p.niveau}</span>
                <span className="text-right text-sm text-lux-slate">
                  <span className="font-semibold tabular-nums text-lux-ink">{fmtPrice(p.mensualite)}{NBSP}TND</span> / mois × {p.nbMensualites}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
