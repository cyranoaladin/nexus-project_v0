import type { LandingLevel, LandingPack } from '@/lib/campaigns/pre-rentree-2026/configurator';

function Amount({ value }: { value: number }) {
  return <span className="whitespace-nowrap tabular-nums">{value.toLocaleString('fr-TN')} TND</span>;
}

function PriceCards({ packs }: { packs: LandingPack[] }) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {packs.map((pack) => (
        <article key={`${pack.level}-${pack.code}`} className="flex flex-col rounded-2xl border border-lux-line bg-white p-5">
          <h4 className="font-semibold text-lux-ink">{pack.subjectsCount} {pack.subjectsCount === 1 ? 'matière' : 'matières'}</h4>
          <p className="mt-1 text-sm text-lux-slate">{pack.totalHours} heures</p>
          <p className="mt-4 font-fraunces text-3xl text-lux-ink"><Amount value={pack.price} /></p>
          <p className="text-sm text-lux-slate">{pack.pricePerHour.toLocaleString('fr-TN')} TND/h</p>
          <dl className="mt-4 space-y-2 border-t border-lux-line pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-lux-slate">Acompte</dt><dd className="font-medium text-lux-ink"><Amount value={pack.deposit} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-lux-slate">Solde</dt><dd className="font-medium text-lux-ink"><Amount value={pack.balance} /></dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function PricingSection({
  packs,
  levels,
  depositPercentage,
  campaignYear,
}: {
  packs: LandingPack[];
  levels: LandingLevel[];
  depositPercentage: number;
  campaignYear: string;
}) {
  const foundationLevels = levels.filter((level) => packs.some((pack) => pack.level === level.id && pack.range === 'FONDATIONS'));
  const premiumLevels = levels.filter((level) => packs.some((pack) => pack.level === level.id && pack.range === 'PREMIUM'));
  const premiumPacks = premiumLevels.length > 0 ? packs.filter((pack) => pack.level === premiumLevels[0].id) : [];
  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Tarifs des stages de pré-rentrée {campaignYear}</h2>
        <p className="mt-3 text-lux-slate">Après validation du parcours, un acompte exact de {depositPercentage} % confirme l’inscription et réserve la place.</p>
        <div className="mt-9 space-y-10">
          {foundationLevels.map((level) => (
            <section key={level.id} aria-labelledby={`pricing-${level.id.toLowerCase()}`}>
              <h3 id={`pricing-${level.id.toLowerCase()}`} className="font-fraunces text-2xl text-lux-ink">Nexus Fondations · {level.label}</h3>
              <PriceCards packs={packs.filter((pack) => pack.level === level.id)} />
            </section>
          ))}
          {premiumLevels.length > 0 && (
            <section aria-labelledby="pricing-premium">
              <h3 id="pricing-premium" className="font-fraunces text-2xl text-lux-ink">Nexus Premium · {premiumLevels.map((level) => level.label.replace(/^Entrée en /, '')).join(' et ')}</h3>
              <PriceCards packs={premiumPacks} />
            </section>
          )}
        </div>
        <ul className="mt-8 space-y-1 text-sm text-lux-slate">
          <li>La demande d’information est sans paiement et ne réserve pas de place.</li>
          <li>Le tarif, l’acompte et le solde sont recalculés depuis les matières validées.</li>
          <li>Les conditions applicables sont communiquées avant la confirmation.</li>
        </ul>
      </div>
    </section>
  );
}
