import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

interface Offer {
  level: EntryLevelCode;
  range: 'FONDATIONS' | 'PREMIUM';
  signature: string;
  capacity: { min: number; max: number };
  serviceCapabilityIds: string[];
}

interface Capability {
  id: string;
  label: string;
  publiclyCommitted: boolean;
}

export function OffersSection({
  offers,
  levels,
  capabilities,
}: {
  offers: Offer[];
  levels: Array<{ id: EntryLevelCode; label: string }>;
  capabilities: Capability[];
}) {
  const capabilityById = new Map(capabilities.map((item) => [item.id, item]));
  const ranges = (['FONDATIONS', 'PREMIUM'] as const).map((range) => {
    const matching = offers.filter((offer) => offer.range === range);
    const committed = [...new Set(matching.flatMap((offer) => offer.serviceCapabilityIds))]
      .map((id) => capabilityById.get(id))
      .filter((item): item is Capability => Boolean(item?.publiclyCommitted));
    return { range, matching, committed };
  });

  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20" aria-labelledby="offers-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="offers-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Fondations ou Premium ?</h2>
        <p className="mt-3 max-w-3xl text-lux-slate">Deux formats Nexus, définis selon les enjeux de la classe de rentrée et la taille du groupe.</p>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {ranges.map(({ range, matching, committed }) => {
            const label = range === 'FONDATIONS' ? 'Nexus Fondations' : 'Nexus Premium';
            const levelLabels = matching.map((offer) => levels.find((level) => level.id === offer.level)?.label ?? offer.level);
            const capacity = matching[0]?.capacity;
            return (
              <article key={range} className="rounded-2xl border border-lux-line bg-white p-6">
                <h3 className="font-fraunces text-2xl text-lux-ink">{label}</h3>
                <p className="mt-2 font-semibold text-lux-gold-deep">{matching[0]?.signature}</p>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-lux-slate">Niveaux</dt><dd className="font-medium text-lux-ink">{levelLabels.join(' · ')}</dd></div>
                  <div><dt className="text-lux-slate">Groupe</dt><dd className="font-medium text-lux-ink">{capacity?.min} à {capacity?.max} élèves</dd></div>
                </dl>
                {committed.length > 0 ? (
                  <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-lux-slate">
                    {committed.map((item) => <li key={item.id}>{item.label}</li>)}
                  </ul>
                ) : (
                  <p className="mt-5 rounded-xl bg-lux-paper p-4 text-sm text-lux-slate">Le contenu précis du parcours est communiqué après l’étude du profil et avant toute confirmation.</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
