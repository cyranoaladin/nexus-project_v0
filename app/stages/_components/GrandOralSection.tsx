import { GRAND_ORAL_DAYS, PACKS } from "../_data/packs";
import CTAButton from "./CTAButton";
import { WHATSAPP_URL } from "../_lib/constants";

const grandOralPack = PACKS.find((pack) => pack.id === "grand-oral");

export default function GrandOralSection() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <span className="rounded-full border border-nexus-purple/30 bg-nexus-purple/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-purple">
            🎤 PACK GRAND ORAL — 10H INTENSIVES
          </span>
          <h2 className="mt-5 font-display text-h2 font-bold text-white">L'Art de Convaincre</h2>
          <p className="mt-4 max-w-xl text-base leading-8 text-white/60">
            20 minutes pour changer ton dossier Parcoursup. Ne laisse pas le trac décider de ta mention.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-full border border-nexus-purple/25 bg-nexus-purple/10 px-4 py-2 text-sm font-semibold text-nexus-purple">
              Solo : 300 TND
            </div>
            <div className="rounded-full border border-nexus-amber/25 bg-nexus-amber/10 px-4 py-2 text-sm font-semibold text-nexus-amber">
              + Stage : 250 TND
            </div>
          </div>

          {grandOralPack?.addOnLabel ? (
            <p className="mt-5 text-sm leading-7 text-white/55">{grandOralPack.addOnLabel}</p>
          ) : null}

          <CTAButton href={WHATSAPP_URL} external variant="purple" className="mt-8">
            Je réserve mon Pack Grand Oral
          </CTAButton>
        </div>

        <div className="grid gap-4">
          {GRAND_ORAL_DAYS.map((day) => (
            <article
              key={day.day}
              className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{day.icon}</span>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nexus-purple">
                      Jour {day.day}
                    </p>
                    <h3 className="font-display text-xl font-bold text-white">{day.title}</h3>
                  </div>
                </div>
                <span className="rounded-full border border-nexus-purple/25 bg-nexus-purple/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-nexus-purple">
                  {day.skill}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/60">{day.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
