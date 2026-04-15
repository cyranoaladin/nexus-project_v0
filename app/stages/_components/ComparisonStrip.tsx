import { Crown, Layers, Target } from "lucide-react";

import { COMPARISON_ITEMS } from "../_data/offers";

const iconMap = {
  target: Target,
  layers: Layers,
  crown: Crown,
} as const;

export default function ComparisonStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {COMPARISON_ITEMS.map((item) => {
        const Icon = iconMap[item.icon];
        return (
          <div
            key={item.category}
            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
          >
            <div className="shrink-0 rounded-xl border border-nexus-green/18 bg-nexus-green/8 p-2.5">
              <Icon className="h-4 w-4 text-nexus-green" aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-white">
                {item.category}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-white/50">
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
