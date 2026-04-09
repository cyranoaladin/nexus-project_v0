import { ArrowRight, Check, MapPinned, Users } from "lucide-react";

import { Pack } from "../_data/packs";
import { getPackBadgeIcon, getPackIcon } from "../_lib/icons";
import { WHATSAPP_URL } from "../_lib/constants";
import CTAButton from "./CTAButton";

type AcademyCardProps = {
  pack: Pack;
};

export default function AcademyCard({ pack }: AcademyCardProps) {
  const Icon = getPackIcon(pack.id);
  const BadgeIcon = getPackBadgeIcon(pack.id);

  return (
    <article
      className={`flex h-full flex-col rounded-[28px] border bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-card ${
        pack.highlight ? "border-nexus-green/25" : "border-white/8"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-3">
            <Icon className="h-6 w-6 text-nexus-green" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold text-white">{pack.title}</h3>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
              {pack.subtitle}
            </p>
          </div>
        </div>
        {pack.badge ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-right font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{
              borderColor: `${pack.badgeColor ?? "#10b981"}55`,
              backgroundColor: `${pack.badgeColor ?? "#10b981"}18`,
              color: pack.badgeColor ?? "#10b981",
            }}
          >
            {BadgeIcon ? <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {pack.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">
          {pack.hours}
        </span>
        <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">
          {pack.perHour}
        </span>
      </div>

      <p className="mt-5 text-sm leading-7 text-white/62">{pack.description}</p>

      <ul className="mt-5 space-y-3 text-sm leading-6 text-white/74">
        {pack.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-nexus-green" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-[22px] border border-white/8 bg-black/20 p-4">
        {pack.vsClassic ? (
          <p className="text-sm text-white/42">
            Équivalent marché :{" "}
            <span className="text-nexus-red line-through decoration-nexus-red/70">
              {pack.vsClassic}
            </span>
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nexus-green">
              Early Bird
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold text-white">
              {pack.earlyBird} TND
            </p>
            <p className="text-sm text-white/48">
              Normal : {pack.price} TND • Économie : {pack.saving} TND
            </p>
            {pack.addOnLabel ? (
              <p className="mt-2 text-sm text-nexus-amber">{pack.addOnLabel}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-right">
            <p className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Places restantes
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-white">{pack.spots}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-white/48">
        <MapPinned className="h-4 w-4 text-nexus-green" aria-hidden="true" />
        Tunis • petits groupes • progression accompagnée
      </div>

      <div className="mt-6">
        <CTAButton href={WHATSAPP_URL} external className="w-full">
          Réserver ma place
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </CTAButton>
      </div>
    </article>
  );
}
