const timelineItems = [
  {
    icon: "🚨",
    date: "18 MAI",
    title: "Épreuve Pratique NSI",
    description: "Les 30 sujets officiels. Aucune seconde chance.",
    accent: "text-nexus-red border-nexus-red/25 bg-nexus-red/8",
  },
  {
    icon: "✍️",
    date: "8 JUIN",
    title: "Bac Français & Maths (1ère)",
    description: "Épreuves anticipées décisives — écrit + oral.",
    accent: "text-nexus-amber border-nexus-amber/25 bg-nexus-amber/8",
  },
  {
    icon: "🎓",
    date: "JUIN",
    title: "Bac Terminale + Grand Oral",
    description: "Épreuve finale. Mention TB à portée de main.",
    accent: "text-nexus-green border-nexus-green/25 bg-nexus-green/8",
  },
];

export default function UrgencyTimeline() {
  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-nexus-red">
            Le calendrier ne négocie pas
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Chaque jour perdu est un point perdu.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {timelineItems.map((item) => (
            <article
              key={item.title}
              className="rounded-[26px] border border-white/8 bg-white/5 p-6 shadow-card"
            >
              <div className={`inline-flex rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${item.accent}`}>
                {item.icon} {item.date}
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/58">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
