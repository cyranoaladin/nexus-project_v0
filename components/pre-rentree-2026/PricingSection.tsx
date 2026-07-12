import type { LandingPack } from '@/lib/campaigns/pre-rentree-2026/configurator';

export function PricingSection({ packs, depositPercentage }: { packs: LandingPack[]; depositPercentage: number }) {
  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Tarifs Pré-rentrée</h2>
        <p className="mt-3 text-lux-slate">Acompte de {depositPercentage} % · pré-inscription sans paiement en ligne · tarifs non cumulables avec les remises automatiques.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => <article key={pack.id} className="flex flex-col rounded-2xl border border-lux-line bg-white p-6"><h3 className="font-semibold text-lux-ink">{pack.subjectsCount} {pack.subjectsCount === 1 ? 'matière' : 'matières'}</h3><p className="mt-1 text-sm text-lux-slate">{pack.totalHours} heures</p><p className="mt-5 font-fraunces text-3xl text-lux-ink">{pack.price.toLocaleString('fr-TN')} TND</p><p className="mt-1 text-sm text-lux-slate">Tarif par élève</p><p className="text-sm text-lux-slate">{pack.pricePerHour.toLocaleString('fr-TN')} TND/h</p><dl className="mt-5 space-y-2 border-t border-lux-line pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-lux-slate">Acompte</dt><dd className="font-medium text-lux-ink">{pack.deposit.toLocaleString('fr-TN')} TND</dd></div><div className="flex justify-between gap-3"><dt className="text-lux-slate">Solde</dt><dd className="font-medium text-lux-ink">{pack.balance.toLocaleString('fr-TN')} TND</dd></div></dl></article>)}
        </div>
        <ul className="mt-6 space-y-1 text-sm text-lux-slate"><li>Groupe ouvert selon le seuil indiqué dans les informations pratiques.</li><li>Une demande sans acompte ne bloque pas une place.</li><li>La Carte Nexus et les remises automatiques ne s'appliquent pas à ces packs.</li></ul>
      </div>
    </section>
  );
}
