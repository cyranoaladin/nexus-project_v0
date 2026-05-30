import { EamPremiereRouteShell } from "@/components/eam-premiere-generale/EamPremiereRouteShell";
import { EAM_PREMIERE_FINAL_WEEKEND } from "@/content/eam-premiere-generale";

export default function EamPremiereWeekendFinalPage() {
  return (
    <EamPremiereRouteShell>
      <section className="space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Week-end final</p>
        <h1 className="text-2xl font-black text-white">Samedi 6 et dimanche 7 juin</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {EAM_PREMIERE_FINAL_WEEKEND.map((day) => (
            <article key={day.date} className="rounded-2xl border border-white/10 bg-surface-card p-5">
              <h2 className="text-xl font-bold text-white">{day.label}</h2>
              <p className="mt-2 text-sm text-neutral-300">{day.intent}</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                {day.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </EamPremiereRouteShell>
  );
}
