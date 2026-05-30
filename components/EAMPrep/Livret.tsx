import { MODULES, STAGE_SESSIONS, WEEKEND_PROTOCOL } from "./data";
import { MathFormula } from "./MathFormula";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-page-break break-inside-avoid rounded-xl border border-white/10 bg-white/[0.035] p-4 print:border-neutral-300 print:bg-white">
      <h2 className="text-lg font-black text-white print:text-neutral-950">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-neutral-300 print:text-neutral-800">{children}</div>
    </section>
  );
}

export function Livret() {
  return (
    <article className="printable-eam-livret mx-auto max-w-5xl space-y-4 text-neutral-100 print:bg-white print:text-neutral-950">
      <header className="rounded-2xl border border-brand-accent/25 bg-gradient-to-br from-brand-accent/10 to-surface-card p-5 print:border-neutral-300 print:bg-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent print:text-neutral-700">Nexus Réussite · Livret élève</p>
        <h1 className="mt-2 text-2xl font-black text-white print:text-neutral-950">Commando EAM — Première spé maths</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300 print:text-neutral-800">
          Support de stage pour travailler en séance, entre les séances et le week-end précédant l'épreuve du 8 juin.
        </p>
      </header>

      <Section title="Planning des 10h">
        <div className="space-y-2">
          {STAGE_SESSIONS.map((session) => (
            <div key={session.id} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="font-bold text-white print:text-neutral-950">{session.title}</p>
              <p className="mt-1 text-xs">{session.objectifs[0]}</p>
              <p className="mt-1 text-xs font-semibold">Travail maison : {session.interSeance[0]}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Protocole week-end">
        <div className="grid gap-3 md:grid-cols-3">
          {WEEKEND_PROTOCOL.map((day) => (
            <div key={day.id} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="font-bold text-white print:text-neutral-950">{day.title}</p>
              <p className="mt-1 text-xs">{day.intention}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {day.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fiches méthodes par module">
        <div className="grid gap-3 md:grid-cols-2">
          {MODULES.map((module) => (
            <div key={module.id} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="font-bold text-white print:text-neutral-950">{module.title}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {module.methodes.slice(0, 3).map((method) => <li key={method}>{method}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Automatismes indispensables">
        <div className="grid gap-3 md:grid-cols-2">
          {MODULES.flatMap((module) => module.formules.slice(0, 2).map((formula) => ({ module, formula }))).map(({ module, formula }) => (
            <div key={`${module.id}-${formula.title}`} className="rounded-lg border border-white/10 p-3 print:border-neutral-300">
              <p className="text-xs font-bold text-brand-accent print:text-neutral-700">{module.title} · {formula.title}</p>
              <div className="mt-2 overflow-x-auto">
                <MathFormula value={formula.content} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Checklist finale">
        <ul className="grid gap-2 md:grid-cols-2">
          {MODULES.flatMap((module) => module.checklist.slice(0, 4).map((item) => `${module.title} — ${item}`)).map((item) => (
            <li key={item} className="rounded-lg bg-surface-darker/50 p-2 print:bg-neutral-100">{item}</li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
