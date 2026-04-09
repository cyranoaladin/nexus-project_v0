import { ArrowRight, Phone, Target } from "lucide-react";

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
      className="relative overflow-hidden bg-nexus-bg px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.22),transparent_42%)]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-white/58">
          <Target className="h-4 w-4 text-nexus-green" aria-hidden="true" />
          Dernier bloc avant réservation
        </div>
        <h2 className="mt-5 font-display text-h2 font-bold text-white">
          Le 2 mai, vous repartez avec un plan de révision prêt à exécuter.
        </h2>
        <p className="mt-5 text-base leading-8 text-white/60">
          Méthode posée, points faibles identifiés, entraînements faits. Il ne reste ensuite qu'à
          capitaliser. 6 élèves max, places dans l'ordre des inscriptions.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <CTAButton href={WHATSAPP_URL} external className="sm:min-w-[250px]">
            Sécuriser ma mention
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CTAButton>
          <CTAButton href={PHONE_LINK} variant="outline" className="sm:min-w-[250px]">
            <Phone className="h-4 w-4" aria-hidden="true" />
            Bilan gratuit
          </CTAButton>
        </div>

        <div className="mt-8 space-y-2 text-sm leading-7 text-white/55">
          <p>{CONTACT_ADDRESS}</p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
              {CONTACT_EMAIL}
            </a>{" "}
            •{" "}
            <a href={PHONE_LINK} className="hover:text-white">
              {PHONE}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
