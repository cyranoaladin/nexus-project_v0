import type { Metadata } from 'next';
import { CalendarClock, MapPin, Users } from 'lucide-react';

import { AtelierInscriptionForm } from '@/components/ateliers/AtelierInscriptionForm';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { DUREE_MINUTES, PLACES_PAR_ATELIER, THEMES, ateliersOuverts } from '@/lib/ateliers';
import { LEGAL } from '@/lib/legal';
import { buildPageMetadata } from '@/lib/seo';

/** Régénérée toutes les heures : un atelier passé disparaît de lui-même. */
export const revalidate = 3600;

const TITRE = 'Ateliers gratuits : comprendre le bac français pour votre enfant';
const DESCRIPTION =
  `Atelier gratuit d’une heure au centre Nexus Réussite (${LEGAL.addresses.pedagogique.neighborhood}, ${LEGAL.addresses.pedagogique.city}) pour les familles d’élèves en 2ème, `
  + '3ème ou 4ème année secondaire : 1ère ou 2ème partie du bac français, programme, rythme, prix et inscription à l’examen.';

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  ...buildPageMetadata({ title: TITRE, description: DESCRIPTION, path: '/ateliers' }),
};

const PROGRAMME = [
  '1ère ou 2ème partie du bac français : laquelle pour votre enfant',
  'Programme, rythme du soir et du week-end, épreuves blanches, bilans réguliers',
  'Plateforme ARIA et manuels Nexus offerts',
  'Prix, paiement et inscription à l’examen : toutes vos questions',
];

export default function AteliersPage() {
  const ouverts = ateliersOuverts(new Date());
  const centre = LEGAL.addresses.pedagogique;

  return (
    <>
      <CorporateNavbar />
      <main className="luxury min-h-screen" id="main-content">
        <section className="bg-lux-ink px-4 pb-14 pt-28 md:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lux-gold-wash">
              Atelier gratuit · {DUREE_MINUTES} minutes · au centre
            </p>
            <h1 className="mt-3 font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
              Votre enfant est en 2ème, 3ème ou 4ème année secondaire ?
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-lux-on-dark-muted">
              Venez avec lui comprendre le bac français en une heure : quelle partie passer, comment se préparer
              sans quitter son lycée, et ce que cela coûte. Gratuit, sans engagement.
            </p>
            <div className="mt-8 grid gap-4 text-sm text-lux-on-dark-muted sm:grid-cols-3">
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-lux-gold-wash" aria-hidden />
                <a href={centre.maps} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-lux-ivory">
                  {centre.full}<span className="sr-only"> (nouvel onglet)</span>
                </a></p>
              <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-lux-gold-wash" aria-hidden />
                {PLACES_PAR_ATELIER} familles au maximum par atelier</p>
              <p className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 text-lux-gold-wash" aria-hidden />
                {ouverts.length > 0 ? `${ouverts.length} dates à venir, en fin de journée et le week-end` : 'Prochaines dates bientôt annoncées'}</p>
            </div>
          </div>
        </section>

        <section className="bg-lux-paper px-4 py-14 md:px-6">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-8">
              <div>
                <h2 className="font-fraunces text-2xl text-lux-ink">Pendant l’atelier</h2>
                <ul className="mt-4 space-y-3 text-lux-slate">
                  {PROGRAMME.map((p) => (
                    <li key={p} className="flex gap-3"><span className="font-bold text-lux-gold-deep" aria-hidden>✓</span>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-fraunces text-2xl text-lux-ink">Les dates</h2>
                {ouverts.length === 0 ? (
                  <p className="mt-4 text-lux-slate">Les ateliers de cette session sont terminés. Écrivez-nous sur WhatsApp.</p>
                ) : (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {ouverts.map((a) => (
                      <li key={a.id} className="rounded-xl border border-lux-line bg-lux-white p-3 text-sm">
                        <span className="block font-semibold text-lux-ink">{a.jour} · {a.heure}</span>
                        <span className="text-lux-slate">{THEMES[a.theme].titre}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-sm text-lux-slate">
                  1ère partie : élèves de 2ème ou 3ème année. 2ème partie : élèves de 3ème ou 4ème année.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-lux-line bg-lux-white p-6 text-lux-ink lux-shadow sm:p-8">
              <h2 className="font-fraunces text-2xl">Je réserve ma place</h2>
              <p className="mb-6 mt-2 text-sm text-lux-slate">Une minute : votre demande part sur WhatsApp, nous confirmons la place.</p>
              <AtelierInscriptionForm />
            </div>
          </div>
        </section>
      </main>
      <CorporateFooter />
    </>
  );
}
