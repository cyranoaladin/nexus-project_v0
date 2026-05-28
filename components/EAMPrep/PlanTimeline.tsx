import { PLAN } from "./data";

export function PlanTimeline() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {PLAN.map((day) => (
        <div
          key={`${day.date}-${day.label}`}
          className={`rounded-xl border bg-surface-card p-4 ${day.today ? "border-brand-accent/40" : "border-white/10"}`}
          style={{ borderLeftColor: day.color, borderLeftWidth: 3 }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-400">{day.date}</p>
            {(day.today || day.final) && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: day.color }}>
                {day.today ? "Aujourd'hui" : "Jour J"}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-black text-white">{day.label}</h3>
          <p className="mt-3 text-sm font-semibold text-neutral-100">{day.focus}</p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">{day.tip}</p>
        </div>
      ))}
    </div>
  );
}
