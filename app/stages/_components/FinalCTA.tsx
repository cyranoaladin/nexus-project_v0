import { ArrowRight, MessageCircle, Phone } from "lucide-react";

import CTAButton from "./CTAButton";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  PHONE,
  PHONE_LINK,
  WHATSAPP_URL,
} from "../_lib/constants";

export default function FinalCTA() {
  return (
    <section
      id="reservation"
      className="relative overflow-hidden bg-nexus-bg px-4 py-28 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_52%)]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-nexus-green">
          Stages Printemps 2026 · 18 avril — 2 mai
        </p>

        <h2 className="mt-4 font-display text-h2 font-bold text-white">
          Le 2 mai, vous repartez avec une méthode posée, des points faibles identifiés et un plan
          de révision prêt à exécuter.
        </h2>

        <p className="mt-5 text-base leading-8 text-white/56">
          Les semaines qui suivent servent à capitaliser sur ce travail — pas à recommencer de
          zéro. Les groupes sont à 6 élèves maximum. Les inscriptions se ferment quand les places
          sont pleines.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <CTAButton href={WHATSAPP_URL} external className="sm:min-w-[260px]">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Réserver ma place
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CTAButton>
          <CTAButton href={PHONE_LINK} variant="outline" className="sm:min-w-[200px]">
            <Phone className="h-4 w-4" aria-hidden="true" />
            Nous appeler
          </CTAButton>
        </div>

        {/* Micro-footer */}
        <div className="mt-14 space-y-2 text-sm leading-7 text-white/36">
          <p>{CONTACT_ADDRESS}</p>
          <p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="transition-colors hover:text-white/65"
            >
              {CONTACT_EMAIL}
            </a>
            {" · "}
            <a href={PHONE_LINK} className="transition-colors hover:text-white/65">
              {PHONE}
            </a>
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/22">
            Excellence pédagogique · Petits groupes · Système français
          </p>
        </div>
      </div>
    </section>
  );
}
