import { EamPremiereRouteShell } from "@/components/eam-premiere-generale/EamPremiereRouteShell";
import { eamPremiereBlankExamStrategy } from "@/content/eam-premiere-generale";

export default function EamPremiereSujetBlancPage() {
  return (
    <EamPremiereRouteShell>
      <section className="rounded-2xl border border-white/10 bg-surface-card p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-accent">Sujet blanc stratégique</p>
        <h1 className="mt-2 text-2xl font-black text-white">{eamPremiereBlankExamStrategy.duration} — méthode d'épreuve</h1>
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {eamPremiereBlankExamStrategy.order.map((item) => (
            <li key={item} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">{item}</li>
          ))}
        </ol>
      </section>
    </EamPremiereRouteShell>
  );
}
