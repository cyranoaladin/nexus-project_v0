import type { Pricing } from "@/lib/pricing";
import { Coins, CreditCard, Lock } from "lucide-react";

export default function PaymentsCredits({ pricing }: { pricing: Pricing; }) {
  const packs = [
    { label: "50 crédits", value: pricing.pack_50_credits ?? 500 },
    { label: "100 crédits", value: pricing.pack_100_credits ?? 1000 },
    { label: "250 crédits", value: pricing.pack_250_credits ?? 2500, note: "Meilleure valeur" },
  ];
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900">Paiements & Crédits</h2>
      <p className="text-gray-600 mt-1">Paiement sécurisé. 1 crédit = 10 TND.</p>

      <div className="mt-4 flex items-center gap-3 text-sm text-gray-700">
        <CreditCard className="w-5 h-5" /><span>Visa</span>
        <CreditCard className="w-5 h-5" /><span>Mastercard</span>
        <Lock className="w-5 h-5" /><span>SEPA</span>
        <Coins className="w-5 h-5" /><span>Cash</span>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {packs.map((p) => (
          <div key={p.label} className="rounded-xl border border-gray-300 bg-white p-4 flex flex-col">
            <div className="font-medium text-gray-900">{p.label}</div>
            <div className="text-gray-700 mt-1">{p.value} TND</div>
            {p.note && <div className="text-xs text-emerald-700 mt-2">{p.note}</div>}
            <div className="mt-auto pt-4">
              <a
                href="/dashboard/parent/paiement"
                className="text-sm border border-gray-300 rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100"
                data-analytics={`cta_credits_${p.label}`}
                data-testid="cta-credits"
                aria-label={`Charger mon compte (${p.label})`}
              >
                Charger mon compte
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
