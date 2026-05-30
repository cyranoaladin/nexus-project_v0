import { EamPremiereRouteShell } from "@/components/eam-premiere-generale/EamPremiereRouteShell";
import { eamPremiereDailyMissions } from "@/content/eam-premiere-generale";

export default function EamPremiereMissionDuJourPage() {
  const mission = eamPremiereDailyMissions[0];

  return (
    <EamPremiereRouteShell>
      <section className="space-y-5 rounded-2xl border border-white/10 bg-surface-card p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Mission du jour</p>
        <h1 className="text-2xl font-black text-white">{mission.title}</h1>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-4">
            <h2 className="font-bold text-white">En séance</h2>
            <ul className="mt-2 space-y-2 text-sm text-neutral-300">
              {mission.inSession.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <h2 className="font-bold text-white">Livrable</h2>
            <p className="mt-2 text-sm text-neutral-300">{mission.deliverable}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <h2 className="font-bold text-white">Après séance</h2>
            <ul className="mt-2 space-y-2 text-sm text-neutral-300">
              {mission.afterSession.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </EamPremiereRouteShell>
  );
}
