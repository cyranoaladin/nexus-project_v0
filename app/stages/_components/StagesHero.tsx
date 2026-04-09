import CountdownChip from "./CountdownChip";
import CTAButton from "./CTAButton";
import { TARGET_DATES, WHATSAPP_URL } from "../_lib/constants";

const stats = [
  { value: "98%", label: "Satisfaction" },
  { value: "+4.2", label: "pts progression" },
  { value: "6 max", label: "par groupe" },
  { value: "Agrégés", label: "& Certifiés" },
];

export default function StagesHero() {
  return (
    <section className="relative overflow-hidden bg-nexus-bg px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.16),transparent_28%)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-40px-64px)] max-w-7xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-nexus-green/25 bg-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/72">
            🌿 STAGES PRINTEMPS 2026 • 18 Avril — 02 Mai
          </span>
          <CountdownChip
            targetDate={TARGET_DATES.stage_start.toISOString()}
            label="avant le stage"
            tone="amber"
          />
        </div>

        <h1 className="max-w-5xl font-display text-hero font-extrabold leading-[0.95] text-white">
          <span className="block">La Dernière Ligne Droite</span>
          <span className="mt-3 block bg-gradient-to-r from-nexus-green via-white to-nexus-amber bg-clip-text text-transparent">
            Vers la Mention
          </span>
        </h1>

        <p className="mt-6 max-w-3xl text-base leading-8 text-white/60 sm:text-lg">
          On ne révise plus, on valide. Simulations réelles, 6 élèves max, enseignants agrégés.
          Première &amp; Terminale — Maths, Français, NSI, Grand Oral.
        </p>

        <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
          <CTAButton href="#academies" className="flex-1">
            Découvrir les Académies →
          </CTAButton>
          <CTAButton href={WHATSAPP_URL} external variant="outline" className="flex-1">
            📞 Consultation gratuite
          </CTAButton>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/68">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2">
              <span className="font-display text-base font-bold text-white">{stat.value}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/52">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
