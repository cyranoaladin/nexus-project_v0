'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import type { AriaResource } from '@/lib/aria/contracts';

interface AriaResourceListProps {
  courseKey: string;
  resources: readonly AriaResource[];
  activeResourceId?: string | null;
}

export const AriaResourceList: React.FC<AriaResourceListProps> = ({
  courseKey,
  resources,
  activeResourceId,
}) => {
  if (resources.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 text-center">
        <p className="text-xs text-slate-400">Aucun document officiel rattaché pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Documents officiels ({resources.length})</span>
        </h3>
      </div>

      <div className="space-y-2">
        {resources.map((res) => {
          const isActive = res.id === activeResourceId;
          const downloadUrl = `/api/aria/resources/${res.id}/content`;

          return (
            <div
              key={res.id}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                isActive
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-slate-200 leading-snug">
                      {res.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{res.sourceLabel}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                        {res.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Télécharger / Ouvrir le PDF officiel"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <Link
                    href={`/dashboard/eleve/aria/${courseKey}/ressources/${res.id}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                    title="Travailler ce document avec ARIA"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
