import { Check } from 'lucide-react';
import { fmtTND } from '@/components/premium/format';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const TIER_LABELS: Record<QuoteScenario['tier'], string> = {
  ESSENTIEL: 'Essentiel',
  RECOMMANDE: 'Recommandé Nexus',
  COMPLET: 'Renforcé / Complet',
};

const MODALITY_LABELS: Record<string, string> = {
  PILOTAGE: 'Pilotage',
  GROUPE: 'Petit groupe',
  DUO: 'Duo',
  INDIVIDUEL: 'Individuel',
  PACK: 'Parcours combiné',
};

export function ScenarioCard({ scenario, featured }: { scenario: QuoteScenario; featured?: boolean }) {
  return (
    <div
      data-testid={`scenario-card-${scenario.tier.toLowerCase()}`}
      className={`flex flex-col overflow-hidden rounded-2xl transition-all ${
        featured
          ? 'ring-2 ring-lux-gold shadow-xl shadow-lux-gold/10'
          : 'border border-lux-line/60 shadow-md shadow-lux-ink/5'
      } bg-lux-white`}
    >
      {featured && (
        <div className="bg-lux-gold px-4 py-1.5 text-center">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-lux-ink">
            Recommandé Nexus
          </span>
        </div>
      )}

      <div className={`border-b border-lux-line/40 px-6 ${featured ? 'pt-4' : 'pt-5'} pb-4`}>
        <span className="lux-eyebrow">{TIER_LABELS[scenario.tier]}</span>
        <div className="mt-2 flex items-baseline gap-2">
          <span data-testid="scenario-monthly-total" className="lux-price text-2xl font-bold text-lux-ink">
            {fmtTND(scenario.monthlyTotal)}
          </span>
          <span className="text-sm font-medium text-lux-slate">/ mois</span>
        </div>
        <p className="mt-1 text-sm text-lux-slate">
          {scenario.months} mensualités identiques · Total {fmtTND(scenario.grandTotal)}
        </p>
        {scenario.matchedOfferId && (
          <p className="mt-2 text-xs font-medium text-lux-evergreen">Correspond à un parcours combiné Nexus</p>
        )}
      </div>

      <div className="flex-grow space-y-3 px-6 py-4">
        {scenario.lines.map((line, i) => (
          <div key={`${line.subject}-${i}`} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-lux-ink">
                {line.label}
                {line.hoursPerMonth != null && line.hoursPerMonth > 0 && (
                  <span className="ml-1 font-normal text-lux-slate">— {line.hoursPerMonth} h/mois</span>
                )}
              </p>
              <p className="text-xs text-lux-slate">
                {MODALITY_LABELS[line.modality] ?? line.modality}
                {line.modality !== 'PILOTAGE' && line.modality !== 'PACK' ? ` · ${fmtTND(line.unitPriceMonthly)}/mois` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {scenario.notRecommended.length > 0 && (
        <div className="border-t border-lux-line/50 bg-lux-paper/60 px-6 py-4">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
            Non recommandé actuellement
          </p>
          <ul className="space-y-1.5">
            {scenario.notRecommended.map((item, i) => (
              <li key={`${item.subject}-${i}`} className="text-xs leading-relaxed text-lux-slate">
                {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
