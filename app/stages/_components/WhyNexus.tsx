import { BookOpen, CheckCircle2, PenLine, Users } from "lucide-react";

const advantages = [
  {
    icon: Users,
    title: "Moins d'élèves par groupe",
    copy: "6 maximum. Chaque intervention garde un niveau d'attention réel. Chaque erreur est corrigée, pas ignorée.",
  },
  {
    icon: PenLine,
    title: "Plus de structure",
    copy: "Chaque heure a un objectif pédagogique précis. On ne survole pas — on prépare une épreuve.",
  },
  {
    icon: BookOpen,
    title: "Plus d'entraînements",
    copy: "Simulations, épreuves blanches, corrections détaillées. On prépare le format, pas seulement le contenu.",
  },
  {
    icon: CheckCircle2,
    title: "Meilleur rendement pédagogique",
    copy: "Un cours collectif classique couvre les notions. Un stage Nexus prépare l'épreuve. La différence est mesurable.",
  },
];

export default function WhyNexus() {
  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          {/* Texte gauche */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
              Pourquoi Nexus Réussite
            </p>
            <h2 className="mt-3 font-display text-h2 font-bold text-white">
              Ce n'est pas une question de prix. C'est une question de densité pédagogique.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Un stage Nexus coûte moins qu'un équivalent en cours individuels et produit plus
              qu'un cours collectif classique. C'est là que le rendement change.
            </p>
          </div>

          {/* Grille droite */}
          <div className="grid gap-4 sm:grid-cols-2">
            {advantages.map((adv) => {
              const Icon = adv.icon;
              return (
                <article
                  key={adv.title}
                  className="rounded-[24px] border border-white/10 bg-[#111826] p-5"
                >
                  <div className="inline-flex rounded-full border border-nexus-green/20 bg-nexus-green/10 p-2.5">
                    <Icon className="h-5 w-5 text-nexus-green" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-white">{adv.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{adv.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
