'use client';

import { ComparisonPoint } from '@/lib/types';
import { Check, X } from 'lucide-react';

interface ComparisonTableProps {
  comparison: ComparisonPoint[];
}

export function ComparisonTable({ comparison }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-accent">
            <th className="text-left py-4 px-4 text-body-md font-bold text-primary">
              Critères
            </th>
            <th className="text-center py-4 px-4">
              <div className="flex flex-col items-center gap-2">
                <span className="eyebrow">Nexus</span>
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="font-heading font-bold text-accent text-lg">N</span>
                </div>
              </div>
            </th>
            <th className="text-center py-4 px-4">
              <div className="flex flex-col items-center gap-2">
                <span className="eyebrow">Traditionnel</span>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="font-heading font-bold text-muted-foreground text-lg">T</span>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((point, idx) => (
            <tr
              key={idx}
              className={`border-b border-border/50 ${
                idx % 2 === 0 ? 'bg-background/50' : ''
              }`}
            >
              <td className="py-4 px-4 text-body-md font-medium text-primary">
                {point.feature}
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-center">
                  {typeof point.nexus === 'boolean' ? (
                    point.nexus ? (
                      <Check className="w-6 h-6 text-secondary" />
                    ) : (
                      <X className="w-6 h-6 text-muted-foreground" />
                    )
                  ) : (
                    <p className="text-center text-body-sm text-primary font-medium">
                      {point.nexus}
                    </p>
                  )}
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-center">
                  {typeof point.traditional === 'boolean' ? (
                    point.traditional ? (
                      <Check className="w-6 h-6 text-secondary" />
                    ) : (
                      <X className="w-6 h-6 text-muted-foreground" />
                    )
                  ) : (
                    <p className="text-center text-body-sm text-muted-foreground">
                      {point.traditional}
                    </p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
