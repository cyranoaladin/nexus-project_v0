import { BookOpen, CheckCircle2, PenLine, Users } from "lucide-react";
import { getRules } from "@/lib/pricing";

function getAdvantages(groupMax: number) {
  return [
  {
    icon: Users,
    title: "Moins d'élèves par groupe",
    copy: `${groupMax} maximum. Chaque intervention garde un niveau d'attention réel. Chaque erreur peut être reprise en séance.`,
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
    title: "Préparation centrée sur l'épreuve",
    copy: "Chaque bloc relie notions, méthode et entraînement au format attendu.",
  },
  ];
}

export default function WhyNexus() {
  const rules = getRules();
  const advantages = getAdvantages(rules.group_max);

  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          {/* Texte gauche */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
              Pourquoi Nexus Réussite
            </p>
            <h2 className="mt-3 font-display text-h2 font-bold text-white">
              Ce n'est pas seulement une question de temps. C'est une question de cadre pédagogique.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/56">
              Un stage Nexus concentre le travail sur un objectif précis : revoir les notions,
              s'entraîner au format de l'épreuve et recevoir des corrections exploitables.
            </p>
          </div>

          {/* Grille droite */}
          <div className="grid gap-4 sm:grid-cols-2">
            {advantages.map((adv) => {
              const Icon = adv.icon;
              return (
                <article
                  key={adv.title}
                  className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
                >
                  <div className="inline-flex rounded-full border border-nexus-green/20 bg-nexus-green/10 p-2.5">
                    <Icon className="h-5 w-5 text-nexus-green" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-white">{adv.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/54">{adv.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
