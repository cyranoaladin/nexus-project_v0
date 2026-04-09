import { BadgeDollarSign, CheckCircle2, TrendingDown, Users } from "lucide-react";

export default function MarketComparison() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Le vrai calcul que personne ne fait
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Le prix affiché ne suffit pas. Il faut regarder le cadre, la densité et la qualité du
            temps utile.
          </h2>
          <p className="mt-4 text-base leading-8 text-white/58">
            C'est là que Nexus devient compétitif : moins d'élèves, plus de structure, plus
            d'entraînement, donc plus de points réellement travaillés par heure.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-nexus-red/20 bg-nexus-red/8 p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-nexus-red/25 bg-black/10 p-2.5">
                <TrendingDown className="h-5 w-5 text-nexus-red" aria-hidden="true" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-red">
                Cours de groupe classique
              </p>
            </div>
            <div className="mt-4 font-display text-5xl font-extrabold text-white">880 TND</div>
            <p className="mt-3 text-sm leading-7 text-white/58">
              22h à 40 TND/h, dans un groupe plus large, sans séquencement précis ni bilan
              individualisé.
            </p>
          </div>

          <div className="relative rounded-[28px] border border-nexus-green/22 bg-nexus-green/8 p-7">
            <span className="absolute right-6 top-6 rounded-full border border-nexus-green/30 bg-nexus-green/12 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-nexus-green">
              Tarif préférentiel
            </span>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-nexus-green/25 bg-black/10 p-2.5">
                <BadgeDollarSign className="h-5 w-5 text-nexus-green" aria-hidden="true" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-green">
                Stage Nexus Réussite
              </p>
            </div>
            <div className="mt-4 font-display text-5xl font-extrabold text-white">550 TND</div>
            <p className="mt-3 text-sm leading-7 text-white/58">
              22h, 6 élèves max, épreuves blanches, correction détaillée, bilan et plan d'action.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Moins d'élèves",
              copy: "Chaque intervention garde un niveau d'attention réel, pas symbolique.",
            },
            {
              icon: CheckCircle2,
              title: "Plus de structure",
              copy: "Chaque heure a un objectif pédagogique et une finalité mesurable.",
            },
            {
              icon: BadgeDollarSign,
              title: "Meilleur rendement",
              copy: "Le coût horaire n'a de sens que s'il produit des points et de la méthode.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="inline-flex rounded-full border border-nexus-green/20 bg-nexus-green/10 p-2.5">
                  <Icon className="h-5 w-5 text-nexus-green" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/58">{item.copy}</p>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-sm leading-7 text-white/64">
          Moins d'élèves, plus de structure, plus d'entraînements corrigés. C'est là que le retour
          sur investissement pédagogique change réellement.
        </p>
      </div>
    </section>
  );
}
