import { ArrowRight } from "lucide-react";

import { WHATSAPP_URL } from "../_lib/constants";

export default function ChooseStage() {
  return (
    <section className="bg-nexus-bg px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Choisir son stage
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Comprendre quelle formule est faite pour vous.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {/* Première */}
          <article className="rounded-[26px] border border-nexus-amber/22 bg-nexus-amber/[0.05] p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-amber">
              Vous êtes en Première
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Deux épreuves anticipées à préparer : Français et Maths. Prenez une formule par
              matière, ou le{" "}
              <strong className="font-semibold text-white">Pack Doublé</strong> qui couvre les
              deux en 40h — à un tarif inférieur aux deux formules séparées.
            </p>
          </article>

          {/* Terminale */}
          <article className="rounded-[26px] border border-nexus-green/22 bg-nexus-green/[0.05] p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-nexus-green">
              Vous êtes en Terminale
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Maths Bac ou NSI selon la spécialité. Si NSI :{" "}
              <strong className="font-semibold text-white">l'écrit seul</strong> ou le{" "}
              <strong className="font-semibold text-white">Pack Complet</strong> (pratique + écrit
              + Grand Oral de spécialité). Le Grand Oral peut s'ajouter à n'importe quel stage.
            </p>
          </article>

          {/* Hésitation */}
          <article className="rounded-[26px] border border-white/10 bg-white/[0.025] p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
              Vous hésitez encore
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Contactez-nous sur WhatsApp. On oriente en cinq minutes selon le profil, les enjeux
              et le calendrier de votre élève.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-nexus-green transition-colors hover:text-white"
            >
              Nous écrire
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
