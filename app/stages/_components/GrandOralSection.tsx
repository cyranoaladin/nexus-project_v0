import { ArrowRight, BadgeCheck, Mic } from "lucide-react";

import { GRAND_ORAL_DAYS, PACKS } from "../_data/packs";
import { getGrandOralDayIcon } from "../_lib/icons";
import { WHATSAPP_URL } from "../_lib/constants";
import CTAButton from "./CTAButton";

const grandOralPack = PACKS.find((pack) => pack.id === "grand-oral");

export default function GrandOralSection() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-nexus-purple/30 bg-nexus-purple/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-purple">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Pack Grand Oral — 10h intensives
          </span>
          <h2 className="mt-5 font-display text-h2 font-bold text-white">L'Art de Convaincre</h2>
          <p className="mt-4 max-w-xl text-base leading-8 text-white/60">
            20 minutes pour changer la perception d'un jury. Le fond compte, mais la maîtrise
            compte tout autant.
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

          <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-sm leading-7 text-white/60">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">
              <BadgeCheck className="h-3.5 w-3.5 text-nexus-purple" aria-hidden="true" />
              Objectif concret
            </div>
            <p className="mt-4">
              Arriver avec une accroche solide, une structure maîtrisée, un corps calme et une
              réponse propre aux questions du jury. Le pack est pensé comme un entraînement de
              passage, pas comme un cours théorique sur la prise de parole.
            </p>
          </div>

          <CTAButton href={WHATSAPP_URL} external variant="purple" className="mt-8">
            Je réserve mon Pack Grand Oral
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CTAButton>
        </div>

        <div className="grid gap-4">
          {GRAND_ORAL_DAYS.map((day) => {
            const Icon = getGrandOralDayIcon(day.day);

            return (
              <article
                key={day.day}
                className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-nexus-purple/20 bg-nexus-purple/10 p-2.5">
                      <Icon className="h-5 w-5 text-nexus-purple" aria-hidden="true" />
                    </div>
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
