import type { Pricing } from "@/lib/pricing";
import { Bot, GraduationCap, Monitor, Users } from "lucide-react";

const OFFERS = [
  { key: "aria", title: "Nexus Cortex (ARIA)", desc: "IA 24/7, quiz, ressources", href: "/offres/nexus-cortex", Icon: Bot, cta: "Activer ARIA" },
  { key: "studio", title: "Studio Flex", desc: "Cours/ateliers à la demande", href: "/offres/studio-flex", Icon: Users, cta: "Réserver une séance" },
  { key: "academies", title: "Académies Nexus", desc: "Stages intensifs (vacances)", href: "/offres/academies-nexus", Icon: GraduationCap, cta: "Voir les stages" },
  { key: "odyssee", title: "Programme Odyssée", desc: "Accompagnement annuel premium", href: "/offres/programme-odyssee", Icon: Monitor, cta: "Rejoindre Odyssée" },
];

export default function OffersGrid({ pricing }: { pricing: Pricing; }) {
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900">Nos solutions</h2>
      <p className="text-gray-600 mt-1">4 univers pour répondre précisément à chaque besoin.</p>
      <div className="mt-6 grid md:grid-cols-4 gap-4">
        {OFFERS.map((o) => (
          <div key={o.key} className="rounded-xl border border-gray-300 bg-white p-4 flex flex-col">
            <o.Icon className="w-6 h-6 text-gray-700" />
            <div className="mt-2 font-medium text-gray-900">{o.title}</div>
            <p className="text-sm text-gray-600 mt-1">{o.desc}</p>
            <div className="mt-auto pt-4">
              <a href={o.href} className="text-sm border border-gray-300 rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100" data-analytics={`cta_offer_${o.key}`}>
                {o.cta}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

