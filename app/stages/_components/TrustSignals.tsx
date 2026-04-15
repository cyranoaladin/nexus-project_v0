import { Award, BookOpenCheck, ClipboardList, Users } from "lucide-react";

const signals = [
  {
    icon: Users,
    title: "6 élèves maximum",
    copy: "Chaque correction est individuelle. Chaque erreur est travaillée. Pas un groupe où on écoute sans être vu.",
  },
  {
    icon: Award,
    title: "Intervenants du système français",
    copy: "Agrégés et certifiés, formés aux épreuves, orientés méthode et résultats. Pas des répétiteurs.",
  },
  {
    icon: BookOpenCheck,
    title: "Épreuves blanches dans chaque formule",
    copy: "On ne finit pas un stage sans avoir été mis en conditions réelles.",
  },
  {
    icon: ClipboardList,
    title: "Bilan individualisé + plan de révision",
    copy: "À la sortie du stage, l'élève sait où il en est et ce qu'il doit faire ensuite. C'est le livrable de fin de stage.",
  },
];

export default function TrustSignals() {
  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
            Ce qui fait la différence
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Avant même le premier cours.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {signals.map((signal) => {
            const Icon = signal.icon;
            return (
              <article
                key={signal.title}
                className="rounded-[26px] border border-white/10 bg-[#111826] p-6"
              >
                <div className="inline-flex rounded-full border border-nexus-green/20 bg-nexus-green/10 p-3">
                  <Icon className="h-5 w-5 text-nexus-green" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-white">{signal.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{signal.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
