import {
  EAM_PREMIERE_FINAL_WEEKEND,
  eamPremiereBlankExamStrategy,
  eamPremiereExamMethods,
  eamPremiereMistakesBank,
  eamPremiereQcmAutomatismes,
  eamPremiereSprintMissions,
} from "@/content/eam-premiere-generale";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-white/10 bg-white/[0.035] p-4 print:border-neutral-300 print:bg-white">
      <h2 className="text-lg font-black text-white print:text-neutral-950">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-neutral-300 print:text-neutral-800">{children}</div>
    </section>
  );
}

export function EamPremiereLivret() {
  return (
    <article className="printable-eam-livret mx-auto max-w-5xl space-y-4 text-neutral-100 print:bg-white print:text-neutral-950">
      <header className="rounded-2xl border border-brand-accent/25 bg-gradient-to-br from-brand-accent/10 to-surface-card p-5 print:border-neutral-300 print:bg-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent print:text-neutral-700">Livret élève</p>
        <h1 className="mt-2 text-2xl font-black text-white print:text-neutral-950">Livret Sprint EAM Maths — Première générale</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300 print:text-neutral-800">
          Un support court pour travailler seul : quoi sécuriser, comment rédiger, quoi faire le week-end final et comment aborder l'épreuve du 8 juin.
        </p>
      </header>

      <Section title="Objectif de l'épreuve">
        <p>Réussir une épreuve de 2 heures en allant chercher les points sûrs : automatismes, méthodes standard, conclusions précises et gestion du temps.</p>
      </Section>

      <Section title="Les points à sécuriser">
        <ul className="grid gap-2 sm:grid-cols-2">
          {["Pourcentages et coefficients", "Tableaux de signes bornés", "Dérivée et variations", "Suites géométriques", "Arbres de probabilités", "Espérance et interprétation"].map((item) => (
            <li key={item} className="rounded-lg bg-surface-darker/50 p-2 print:bg-neutral-100">{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="Planning des 10h">
        <div className="space-y-2">
          {eamPremiereSprintMissions.map((mission) => (
            <div key={mission.id} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="font-bold text-white print:text-neutral-950">Séance {mission.sessionNumber} — {mission.title}</p>
              <p className="mt-1 text-xs">{mission.objective}</p>
              <p className="mt-1 text-xs font-semibold">Travail maison : {mission.homework.tasks[0]}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Automatismes indispensables">
        <ul className="space-y-2">
          {eamPremiereQcmAutomatismes.map((item) => (
            <li key={item.id}><strong>{item.prompt}</strong> Réponse : {item.answer}. {item.correction}</li>
          ))}
        </ul>
      </Section>

      <Section title="Fonctions et dérivation">
        <p>Avant tout tableau, écrire le domaine. Après tout extremum, écrire la valeur et le point où elle est atteinte. Pour une tangence, nommer le contact.</p>
      </Section>

      <Section title="Suites et évolutions">
        <p>Passer par le coefficient multiplicateur. Pour une suite géométrique : nature, premier terme, raison, formule, puis interprétation du rang.</p>
      </Section>

      <Section title="Probabilités et variables aléatoires">
        <p>Sur un arbre, multiplier le long d'un chemin et additionner les chemins qui mènent au même événement. Pour une variable aléatoire, vérifier la somme des probabilités et interpréter l'espérance.</p>
      </Section>

      <Section title="Méthode sujet blanc">
        <ol className="space-y-2">
          {eamPremiereBlankExamStrategy.order.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Section>

      <Section title="Erreurs fréquentes">
        <ul className="space-y-2">
          {eamPremiereMistakesBank.map((mistake) => (
            <li key={mistake.id}><strong>{mistake.trap}</strong> {mistake.repair}</li>
          ))}
        </ul>
      </Section>

      <Section title="Week-end final">
        <div className="grid gap-3 sm:grid-cols-2">
          {EAM_PREMIERE_FINAL_WEEKEND.map((day) => (
            <div key={day.date} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="font-bold text-white print:text-neutral-950">{day.label}</p>
              <p className="text-xs">{day.intent}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {day.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Checklist veille d'épreuve">
        <ul className="grid gap-2 sm:grid-cols-2">
          {eamPremiereExamMethods.flatMap((method) => method.checklist).slice(0, 8).map((item) => (
            <li key={item} className="rounded-lg bg-surface-darker/50 p-2 print:bg-neutral-100">{item}</li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
