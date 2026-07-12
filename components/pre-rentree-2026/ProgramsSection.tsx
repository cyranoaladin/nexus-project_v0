'use client';

import { useState } from 'react';

interface ProgramsSectionProps {
  modules: Array<{
    id: string;
    level: string;
    subject: string;
    title: string;
    subtitle: string;
    sessions: Array<{ number: number; title: string; objective: string }>;
  }>;
  levels: Array<{ id: string; label: string }>;
}

export function ProgramsSection({ modules, levels }: ProgramsSectionProps) {
  const [activeLevel, setActiveLevel] = useState(levels[0]?.id ?? 'SECONDE');
  const [openModule, setOpenModule] = useState<string | null>(null);

  const filteredModules = modules.filter(m => m.level === activeLevel);

  return (
    <section className="bg-lux-paper py-14 md:py-20 px-4" aria-labelledby="programs-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="programs-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-6">
          Programmes détaillés
        </h2>

        <div role="tablist" aria-label="Filtrer par niveau" className="flex gap-2 mb-8 flex-wrap">
          {levels.map(level => (
            <button
              key={level.id}
              role="tab"
              aria-selected={activeLevel === level.id}
              onClick={() => { setActiveLevel(level.id); setOpenModule(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                activeLevel === level.id
                  ? 'bg-lux-ink text-lux-on-dark'
                  : 'bg-white text-lux-ink hover:bg-lux-ink/5'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredModules.map(mod => {
            const isOpen = openModule === mod.id;
            const panelId = `program-panel-${mod.id}`;
            const buttonId = `program-button-${mod.id}`;

            return (
              <div key={mod.id} className="rounded-xl border border-lux-line bg-white overflow-hidden">
                <button
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenModule(isOpen ? null : mod.id)}
                  className="flex w-full items-center justify-between p-5 text-left min-h-[44px]"
                >
                  <div>
                    <h3 className="font-semibold text-lux-ink">{mod.title}</h3>
                    <p className="text-sm text-lux-slate mt-0.5">{mod.subtitle}</p>
                  </div>
                  <span className="ml-4 shrink-0 text-lux-slate" aria-hidden="true">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="border-t border-lux-line p-5"
                >
                  <ol className="space-y-4">
                    {mod.sessions.map(session => (
                      <li key={session.number} className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-lux-gold/10 text-xs font-semibold text-lux-gold-deep">
                          {session.number}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-lux-ink">{session.title}</p>
                          <p className="text-sm text-lux-slate">{session.objective}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
