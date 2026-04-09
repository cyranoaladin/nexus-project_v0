import { ArrowRight, Mic } from "lucide-react";

import { GRAND_ORAL_DAYS } from "../_data/packs";
import { getGrandOralDayIcon } from "../_lib/icons";
import { WHATSAPP_URL } from "../_lib/constants";
import CTAButton from "./CTAButton";

export default function GrandOralSection() {
  return (
    <section className="bg-nexus-bg px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          {/* Colonne gauche */}
          <div className="lg:sticky lg:top-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-nexus-purple/28 bg-nexus-purple/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-purple">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              Grand Oral — 10h intensives
            </span>

            <h2 className="mt-5 font-display text-h2 font-bold text-white">
              Le Grand Oral ne se prépare pas en deux jours.
            </h2>

            <p className="mt-4 max-w-md text-base leading-8 text-white/58">
              Il dure 20 minutes en salle — mais ce qui se passe dans ces 20 minutes dépend de
              semaines de travail sur des points très précis.
            </p>

            <div className="mt-6 space-y-4 text-sm leading-7 text-white/60">
              <p>
                <strong className="font-semibold text-white">Les deux questions</strong> doivent
                être construites, problématisées, défendables. Le jury en choisit une. Il faut
                être prêt sur les deux.
              </p>
              <p>
                <strong className="font-semibold text-white">L'exposé de 10 minutes</strong>{" "}
                exige une structure claire, une introduction mémorable, une gestion rigoureuse
                du temps — sans notes, face à deux examinateurs.
              </p>
              <p>
                <strong className="font-semibold text-white">L'échange de 10 minutes</strong>{" "}
                est souvent celui qui fait la différence. Il se travaille : questions difficiles,
                reformulations, tenir sans craquer.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="rounded-full border border-nexus-purple/25 bg-nexus-purple/10 px-4 py-2 text-sm font-semibold text-nexus-purple">
                Solo — Early Bird : 300 TND
              </div>
              <div className="rounded-full border border-nexus-amber/25 bg-nexus-amber/10 px-4 py-2 text-sm font-semibold text-nexus-amber">
                + Stage : 250 TND
              </div>
            </div>

            <CTAButton href={WHATSAPP_URL} external variant="purple" className="mt-7">
              Ajouter le Grand Oral
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CTAButton>
          </div>

          {/* Colonne droite — programme */}
          <div className="space-y-4">
            {GRAND_ORAL_DAYS.map((day) => {
              const Icon = getGrandOralDayIcon(day.day);
              return (
                <article
                  key={day.day}
                  className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-xl border border-nexus-purple/20 bg-nexus-purple/10 p-2.5">
                        <Icon className="h-4 w-4 text-nexus-purple" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-nexus-purple">
                          Séquence {day.day}
                        </p>
                        <h3 className="mt-0.5 font-display text-lg font-bold text-white">
                          {day.title}
                        </h3>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-nexus-purple/20 bg-nexus-purple/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-nexus-purple">
                      {day.skill}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/56">{day.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
