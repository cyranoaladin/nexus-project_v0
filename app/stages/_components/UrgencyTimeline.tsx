import { ArrowRight } from "lucide-react";

import { getTimelineIcon } from "../_lib/icons";

const timelineItems = [
  {
    kind: "nsi" as const,
    date: "18 mai",
    title: "Épreuve pratique NSI",
    description: "Les 30 sujets officiels. C'est l'échéance la plus proche, donc la plus stratégique.",
    accent: "text-nexus-red border-nexus-red/25 bg-nexus-red/8",
  },
  {
    kind: "eaf" as const,
    date: "8 juin",
    title: "Bac Français & Maths de Première",
    description: "Écrit, oral, automatismes et méthode. Les points se gagnent maintenant, pas la veille.",
    accent: "text-nexus-amber border-nexus-amber/25 bg-nexus-amber/8",
  },
  {
    kind: "oral" as const,
    date: "juin",
    title: "Bac Terminale + Grand Oral",
    description: "La dernière séquence de l'année. Le but est d'arriver préparé, pas simplement rassuré.",
    accent: "text-nexus-green border-nexus-green/25 bg-nexus-green/8",
  },
];

export default function UrgencyTimeline() {
  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-nexus-red">
              Le calendrier ne négocie pas
            </p>
            <h2 className="mt-3 font-display text-h2 font-bold text-white">
              Chaque jour perdu réduit la marge de progression.
            </h2>
            <p className="mt-4 text-base leading-8 text-white/58">
              Les stages servent à sécuriser les points les plus proches, puis à transformer cette
              avance en confiance pour les épreuves de juin.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 text-sm leading-7 text-white/62">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">
              <ArrowRight className="h-3.5 w-3.5 text-nexus-green" aria-hidden="true" />
              Ordre de décision recommandé
            </div>
            <p className="mt-4">
              D'abord sécuriser l'épreuve la plus proche. Ensuite choisir le pack qui crée le
              maximum de points sur le temps disponible. Enfin réserver pendant qu'il reste des
              places dans des groupes vraiment courts.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {timelineItems.map((item) => {
            const Icon = getTimelineIcon(item.kind);

            return (
              <article
                key={item.title}
                className="rounded-[26px] border border-white/8 bg-white/5 p-6 shadow-card"
              >
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${item.accent}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.date}
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/58">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
