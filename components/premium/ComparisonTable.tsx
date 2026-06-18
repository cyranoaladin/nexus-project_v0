'use client';

import { Check, X } from 'lucide-react';

export interface ComparisonRow {
  feature: string;
  nexus: string | boolean;
  traditional: string | boolean;
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
}

function CellContent({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-lux-evergreen" />
    ) : (
      <X className="h-5 w-5 text-lux-slate/40" />
    );
  }
  return <span className="text-sm text-lux-ink">{value}</span>;
}

export function ComparisonTable({ rows }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-lux-line bg-lux-white lux-shadow">
      <table className="w-full">
        <thead>
          <tr className="lux-filet-gold">
            <th className="px-5 py-4 text-left text-sm font-semibold text-lux-ink">
              Critères
            </th>
            <th className="px-5 py-4 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <span className="lux-eyebrow">Nexus Réussite</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lux-gold/15">
                  <span className="font-fraunces text-lg font-medium text-lux-gold">N</span>
                </div>
              </div>
            </th>
            <th className="px-5 py-4 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <span className="lux-eyebrow text-lux-slate">Soutien classique</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lux-ivory">
                  <span className="font-fraunces text-lg font-medium text-lux-slate">T</span>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-lux-line/40 ${
                i % 2 === 0 ? 'bg-lux-paper/40' : ''
              }`}
            >
              <td className="px-5 py-3.5 text-sm font-medium text-lux-ink">
                {row.feature}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-center">
                  <CellContent value={row.nexus} />
                </div>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-center">
                  <CellContent value={row.traditional} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
