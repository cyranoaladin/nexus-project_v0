import { getTimelineIcon } from "../_lib/icons";

const timelineItems = [
  {
    kind: "nsi" as const,
    date: "18 mai",
    eyebrow: "Urgence NSI",
    title: "Épreuve pratique NSI",
    description:
      "Épreuve sur ordinateur, format officiel 2026. Le format s'apprend — c'est précisément l'objet du stage.",
    accent: "text-nexus-red border-nexus-red/25 bg-nexus-red/8",
  },
  {
    kind: "eaf" as const,
    date: "8 juin",
    eyebrow: "Première · Contexte Tunisie",
    title: "Épreuves Anticipées de Première",
    description:
      "Français écrit et Maths le même jour de session. Pour les Maths, une nouvelle épreuve : format court, sans calculatrice, avec automatismes. La méthode compte autant que les connaissances.",
    accent: "text-nexus-amber border-nexus-amber/25 bg-nexus-amber/8",
  },
  {
    kind: "oral" as const,
    date: "Juin",
    eyebrow: "Terminale",
    title: "Bac Terminale + Grand Oral",
    description:
      "La séquence finale. Le Grand Oral ne s'improvise pas : les deux questions, la structure de l'exposé et la gestion de l'échange avec le jury se travaillent.",
    accent: "text-nexus-green border-nexus-green/25 bg-nexus-green/8",
  },
];

export default function UrgencyTimeline() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-nexus-red">
              Le calendrier ne négocie pas
            </p>
            <h2 className="mt-3 font-display text-h2 font-bold text-white">
              Chaque étape a une date. Toutes sont proches.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Les stages couvrent les trois séquences critiques de l'année. L'ordre de priorité
              dépend de votre profil.
            </p>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-[#111826] p-5 text-sm leading-7 text-slate-300">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Ordre de décision recommandé
            </p>
            <p className="mt-3">
              D'abord sécuriser l'épreuve la plus proche. Ensuite choisir le pack qui couvre le
              maximum d'échéances sur le temps disponible. Enfin réserver pendant qu'il reste
              des places dans les groupes.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {timelineItems.map((item) => {
            const Icon = getTimelineIcon(item.kind);
            return (
              <article
                key={item.title}
                className="rounded-[26px] border border-white/10 bg-[#141d2e] p-7 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] ${item.accent}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.date}
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                    {item.eyebrow}
                  </p>
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
