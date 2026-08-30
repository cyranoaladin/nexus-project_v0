'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Circle, Target } from 'lucide-react';
import type { AriaSkillGraph, AriaDomain, AriaCompetency } from '@/lib/aria/curriculum/skill-graph';

interface AriaSkillTreeProps {
  courseKey: string;
  graph: AriaSkillGraph;
  activeSkillId?: string | null;
  onSelectSkill?: (skillId: string) => void;
}

export const AriaSkillTree: React.FC<AriaSkillTreeProps> = ({
  courseKey,
  graph,
  activeSkillId,
  onSelectSkill,
}) => {
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(() => {
    // Par défaut, développer le premier domaine ou le domaine contenant la compétence active
    const initial: Record<string, boolean> = {};
    graph.domains.forEach((d: AriaDomain, idx: number) => {
      const containsActive = d.competencies.some(
        (c: AriaCompetency) => c.rawSkillId === activeSkillId || c.id === activeSkillId
      );
      initial[d.id] = containsActive || idx === 0;
    });
    return initial;
  });

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) => ({
      ...prev,
      [domainId]: !prev[domainId],
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          <span>Arborescence des compétences ({graph.totalCompetencies})</span>
        </h3>
      </div>

      <div className="space-y-2">
        {graph.domains.map((domain: AriaDomain) => {
          const isExpanded = expandedDomains[domain.id];
          return (
            <div
              key={domain.id}
              className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => toggleDomain(domain.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/40 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="font-medium text-sm text-slate-200 truncate">
                    {domain.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full shrink-0 ml-2">
                  {domain.competencies.length}
                </span>
              </button>

              {isExpanded && (
                <div className="p-2 pt-0 space-y-1">
                  {domain.competencies.map((comp: AriaCompetency) => {
                    const isSelected =
                      comp.rawSkillId === activeSkillId || comp.id === activeSkillId;

                    return (
                      <div
                        key={comp.id}
                        onClick={() => onSelectSkill?.(comp.rawSkillId)}
                        className={`group flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-500/10 border border-sky-500/30 text-sky-200'
                            : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <Circle
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            isSelected ? 'text-sky-400 fill-sky-400/20' : 'text-slate-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-normal leading-relaxed">{comp.label}</p>
                          {comp.chapterId && (
                            <span className="inline-block mt-1 font-mono text-[10px] text-slate-500">
                              {comp.chapterId}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/dashboard/eleve/aria/${courseKey}/${comp.rawSkillId}`}
                          className="opacity-0 group-hover:opacity-100 text-sky-400 hover:text-sky-300 text-[11px] font-medium transition-opacity shrink-0 ml-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Focus
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
