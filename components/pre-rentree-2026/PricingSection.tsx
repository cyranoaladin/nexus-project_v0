interface PricingSectionProps {
  packs: Array<{
    id: string;
    subjectsCount: number;
    totalHours: number;
    price: number;
    deposit: number;
    balance: number;
  }>;
}

export function PricingSection({ packs }: PricingSectionProps) {
  return (
    <section className="bg-lux-paper py-14 md:py-20 px-4" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="pricing-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-2">
          Tarifs
        </h2>
        <p className="text-lux-slate mb-8">
          Acompte de 30 % à l'inscription. Groupes de 3 à 5 élèves. Tarifs non cumulables avec les remises automatiques.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="rounded-xl border border-lux-line bg-white p-6 flex flex-col"
            >
              <p className="text-sm font-medium text-lux-slate mb-1">
                {pack.subjectsCount} {pack.subjectsCount === 1 ? 'matière' : 'matières'}
              </p>
              <p className="text-sm text-lux-slate mb-4">{pack.totalHours} heures</p>
              <p className="font-fraunces text-2xl text-lux-ink mb-1">
                {pack.price.toLocaleString('fr-TN')} TND
              </p>
              <div className="mt-auto pt-4 border-t border-lux-line text-sm text-lux-slate space-y-1">
                <p>Acompte : {pack.deposit} TND</p>
                <p>Solde : {pack.balance} TND</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-sm text-lux-slate space-y-1">
          <p>Groupe ouvert à partir de 3 élèves, maximum 5.</p>
          <p>La demande sans acompte ne bloque pas une place.</p>
          <p>Pré-inscription sans paiement en ligne.</p>
        </div>
      </div>
    </section>
  );
}
