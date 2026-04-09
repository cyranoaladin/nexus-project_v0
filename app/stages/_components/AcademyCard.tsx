import { Pack } from "../_data/packs";
import { WHATSAPP_URL } from "../_lib/constants";
import CTAButton from "./CTAButton";

type AcademyCardProps = {
  pack: Pack;
};

export default function AcademyCard({ pack }: AcademyCardProps) {
  return (
    <article
      className={`flex h-full flex-col rounded-[28px] border bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-card ${
        pack.highlight ? "border-nexus-green/25" : "border-white/8"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl">{pack.icon}</div>
          <h3 className="mt-4 font-display text-2xl font-bold text-white">{pack.title}</h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
            {pack.subtitle}
          </p>
        </div>
        {pack.badge ? (
          <span
            className="rounded-full border px-3 py-1 text-right font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{
              borderColor: `${pack.badgeColor ?? "#10b981"}55`,
              backgroundColor: `${pack.badgeColor ?? "#10b981"}18`,
              color: pack.badgeColor ?? "#10b981",
            }}
          >
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
            <span className="text-nexus-green">✓</span>
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

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nexus-green">
              Early Bird
            </p>
            <p className="font-display text-4xl font-extrabold text-white">{pack.earlyBird} TND</p>
            <p className="text-sm text-white/48">
              Normal : {pack.price} TND • Économie : {pack.saving} TND
            </p>
            {pack.addOnLabel ? (
              <p className="mt-2 text-sm text-nexus-amber">{pack.addOnLabel}</p>
            ) : null}
          </div>

          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
              Places restantes
            </p>
            <p className="font-display text-2xl font-bold text-white">{pack.spots}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CTAButton href={WHATSAPP_URL} external className="w-full">
          Réserver ma place
        </CTAButton>
      </div>
    </article>
  );
}
