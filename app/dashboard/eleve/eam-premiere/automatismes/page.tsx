import { EamPremiereRouteShell } from "@/components/eam-premiere-generale/EamPremiereRouteShell";
import { eamPremiereQcmAutomatismes } from "@/content/eam-premiere-generale";

export default function EamPremiereAutomatismesPage() {
  return (
    <EamPremiereRouteShell>
      <section className="space-y-4">
        <h1 className="text-2xl font-black text-white">Automatismes indispensables</h1>
        <div className="grid gap-3 md:grid-cols-2">
          {eamPremiereQcmAutomatismes.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-surface-card p-4">
              <p className="text-sm font-semibold text-white">{item.prompt}</p>
              <p className="mt-2 text-sm text-brand-accent">Réponse : {item.answer}</p>
              <p className="mt-1 text-xs text-neutral-400">{item.correction}</p>
            </article>
          ))}
        </div>
      </section>
    </EamPremiereRouteShell>
  );
}
