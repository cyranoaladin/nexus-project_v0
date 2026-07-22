import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { PreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

type PublicOffer = PreRentreePublicSurfaceDTO['offers'][number];

function Amount({ value }: { value: number }) {
  return <span className="whitespace-nowrap tabular-nums">{value.toLocaleString('fr-TN')} TND</span>;
}

function offerTitle(offer: PublicOffer): string {
  if (offer.pricingKind === 'FOUNDATIONS') return offer.subjectLabels[0] ?? offer.levelLabel;
  return `${offer.subjectCount} ${offer.subjectCount === 1 ? 'matière' : 'matières'} au choix`;
}

function contactMessage(offer: PublicOffer): string {
  const choice = offer.pricingKind === 'FOUNDATIONS'
    ? offer.subjectLabels[0]
    : `${offer.subjectCount} matière${offer.subjectCount > 1 ? 's' : ''}`;
  return `Bonjour, je souhaite des informations sur la pré-rentrée 2026 : ${offer.levelLabel}, ${choice}.`;
}

export function CanonicalOfferCatalogue({
  data,
  heading = 'Choisir une offre par niveau',
}: {
  data: PreRentreePublicSurfaceDTO;
  heading?: string;
}) {
  return (
    <section className="bg-lux-paper px-4 py-14 md:px-6 md:py-20" aria-labelledby="canonical-offers-heading">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lux-gold-deep">Tarifs issus du référentiel canonique</p>
        <h2 id="canonical-offers-heading" className="mt-3 font-fraunces text-3xl text-lux-ink md:text-4xl">{heading}</h2>
        <p className="mt-3 max-w-3xl text-lux-slate">
          Chaque carte précise les matières autorisées, le volume, l’effectif, les éléments inclus et ce qui ne l’est pas. Aucun service numérique ou annuel n’est ajouté par défaut.
        </p>

        <div className="mt-10 space-y-12">
          {data.levels.map((level) => {
            const offers = data.offers.filter((offer) => offer.level === level.id);
            return (
              <section key={level.id} aria-labelledby={`offer-level-${level.id.toLowerCase()}`}>
                <div className="flex flex-col justify-between gap-3 border-b border-lux-line pb-4 sm:flex-row sm:items-end">
                  <div>
                    <h3 id={`offer-level-${level.id.toLowerCase()}`} className="font-fraunces text-2xl text-lux-ink">{level.label}</h3>
                    <p className="mt-1 text-sm text-lux-slate">Matières disponibles : {level.subjects.map((subject) => subject.label).join(' · ')}</p>
                  </div>
                  <p className="text-sm font-semibold text-lux-ink">{offers.length} {offers.length === 1 ? 'offre' : 'offres'}</p>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {offers.map((offer) => {
                    const whatsappUrl = buildWhatsAppUrl(contactMessage(offer), { exactMessage: true });
                    return (
                      <article key={offer.offerId} className="flex flex-col rounded-2xl border border-lux-line bg-white p-5 lux-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-lux-gold-deep">{offer.pricingKind === 'FOUNDATIONS' ? 'Fondations' : 'Premium'}</p>
                            <h4 className="mt-1 font-fraunces text-xl text-lux-ink">{offerTitle(offer)}</h4>
                          </div>
                          <p className="font-fraunces text-2xl text-lux-ink"><Amount value={offer.price} /></p>
                        </div>
                        {offer.pricingKind === 'PREMIUM_PACK' && (
                          <p className="mt-3 text-sm text-lux-slate">Au choix parmi : {offer.subjectLabels.join(', ')}.</p>
                        )}
                        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-lux-line py-4 text-sm">
                          <div><dt className="text-lux-slate">Volume</dt><dd className="font-semibold text-lux-ink">{offer.hours} h · {offer.sessions} séances</dd></div>
                          <div><dt className="text-lux-slate">Effectif</dt><dd className="font-semibold text-lux-ink">{offer.groupMin} à {offer.groupMax} élèves</dd></div>
                          <div><dt className="text-lux-slate">Acompte 30 %</dt><dd className="font-semibold text-lux-ink"><Amount value={offer.deposit} /></dd></div>
                          <div><dt className="text-lux-slate">Solde</dt><dd className="font-semibold text-lux-ink"><Amount value={offer.balance} /></dd></div>
                        </dl>
                        <div className="mt-5 grid gap-4 text-sm">
                          <div>
                            <h5 className="font-semibold text-lux-ink">Inclus</h5>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-lux-slate">{offer.included.map((item) => <li key={item}>{item}</li>)}</ul>
                          </div>
                          {offer.optional.length > 0 && (
                            <div><h5 className="font-semibold text-lux-ink">En option</h5><ul className="mt-2 list-disc space-y-1 pl-5 text-lux-slate">{offer.optional.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          )}
                          <div>
                            <h5 className="font-semibold text-lux-ink">Non inclus</h5>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-lux-slate">{offer.excluded.map((item) => <li key={item}>{item}</li>)}</ul>
                          </div>
                        </div>
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lux-cta-reserve mt-auto inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold">
                          {offer.cta} <span className="sr-only">— {level.label}, {offerTitle(offer)} (nouvel onglet)</span>
                        </a>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
