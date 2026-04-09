import { ArrowRight, Check, Users } from "lucide-react";

import { Pack } from "../_data/packs";
import { getPackIcon } from "../_lib/icons";
import { WHATSAPP_URL } from "../_lib/constants";
import CTAButton from "./CTAButton";

type AcademyCardProps = {
  pack: Pack;
};

export default function AcademyCard({ pack }: AcademyCardProps) {
  const Icon = getPackIcon(pack.id);

  return (
    <article
      className={`flex h-full flex-col rounded-[28px] border bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${
        pack.highlight
          ? "border-nexus-green/30 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
          : "border-white/8 hover:border-white/15"
      }`}
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-[18px] border border-white/10 bg-white/[0.05] p-2.5">
            <Icon className="h-5 w-5 text-nexus-green" aria-hidden="true" />
          </div>
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: pack.highlight ? (pack.badgeColor ?? "#10b981") : "rgba(255,255,255,0.38)" }}
            >
              {pack.subtitle}
            </p>
            <h3 className="mt-1 font-display text-xl font-bold leading-snug text-white">
              {pack.title}
            </h3>
          </div>
        </div>

        {pack.badge ? (
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{
              borderColor: `${pack.badgeColor ?? "#10b981"}55`,
              backgroundColor: `${pack.badgeColor ?? "#10b981"}14`,
              color: pack.badgeColor ?? "#10b981",
            }}
          >
            {pack.badge}
          </span>
        ) : null}
      </div>

      {/* Format */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/48">
          {pack.hours}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/48">
          <Users className="h-3 w-3" aria-hidden="true" />
          6 élèves max
        </span>
      </div>

      {/* Promesse */}
      <p className="mt-4 text-sm leading-7 text-white/60">{pack.description}</p>

      {/* Inclus */}
      <ul className="mt-5 space-y-2.5 text-sm leading-6 text-white/70">
        {pack.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-nexus-green"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Pousse le prix vers le bas */}
      <div className="mt-auto" />

      {/* Bloc prix */}
      <div className="mt-6 rounded-[20px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-nexus-green">
              Early Bird — jusqu'au 12 avril
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold leading-none text-white">
              {pack.earlyBird} TND
            </p>
            <p className="mt-1 text-xs text-white/40">
              Tarif normal : {pack.price} TND
              {pack.addOnLabel ? <span className="block mt-0.5 text-nexus-amber">{pack.addOnLabel}</span> : null}
            </p>
          </div>

          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
              Places
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold text-white">{pack.spots}</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4">
        <CTAButton href={WHATSAPP_URL} external className="w-full">
          Réserver
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CTAButton>
      </div>
    </article>
  );
}
