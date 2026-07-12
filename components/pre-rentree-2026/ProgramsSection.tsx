'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toPreRentreeEntryLevel, track } from '@/lib/analytics';
import type { LandingLevel, LandingSubject } from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

interface CampaignModule {
  id: string;
  level: EntryLevelCode;
  subjectId: string;
  subject: string;
  title: string;
  subtitle: string;
  prerequisites: string;
  differentiation: string;
  quickAssessment: string;
  sessions: Array<{ number: number; title: string; objective: string; topics: string[]; method: string; deliverable: string }>;
}

export function ProgramsSection({ modules, levels }: { modules: CampaignModule[]; levels: LandingLevel[]; subjects: LandingSubject[] }) {
  const [level, setLevel] = useState(levels[0]?.id ?? 'SECONDE');
  const [openModule, setOpenModule] = useState<string | null>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const visibleModules = modules.filter((campaignModule) => campaignModule.level === level);

  useEffect(() => {
    function openTargetedModule() {
      const targetId = window.location.hash.replace(/^#programme-/, '');
      const target = modules.find((campaignModule) => campaignModule.id === targetId);
      if (!target) return;
      setLevel(target.level);
      setOpenModule(target.id);
      track.preRentreeProgramViewed(
        toPreRentreeEntryLevel(target.level),
        target.subjectId.toLowerCase(),
      );
      requestAnimationFrame(() => {
        document.getElementById(`programme-${target.id}`)?.scrollIntoView?.({ block: 'start' });
      });
    }

    window.addEventListener('hashchange', openTargetedModule);
    openTargetedModule();
    return () => window.removeEventListener('hashchange', openTargetedModule);
  }, [modules]);

  function handleLevelKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? levels.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + levels.length) % levels.length;
    setLevel(levels[nextIndex].id);
    setOpenModule(null);
    tabsRef.current[nextIndex]?.focus();
  }

  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20" aria-labelledby="programs-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="programs-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Programmes détaillés</h2>
        <p className="mt-3 max-w-3xl text-lux-slate">Consultez un module à la fois pour garder une lecture claire des objectifs et des cinq séances.</p>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les programmes par classe de rentrée">
          {levels.map((option, index) => <button key={option.id} ref={(element) => { tabsRef.current[index] = element; }} id={`program-level-${option.id}`} role="tab" aria-selected={level === option.id} aria-controls="program-list" tabIndex={level === option.id ? 0 : -1} onKeyDown={(event) => handleLevelKeys(event, index)} onClick={() => { setLevel(option.id); setOpenModule(null); }} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${level === option.id ? 'bg-lux-ink text-lux-ivory' : 'border border-lux-line bg-white text-lux-ink'}`}>{option.label}</button>)}
        </div>
        <div id="program-list" role="tabpanel" aria-labelledby={`program-level-${level}`} className="mt-8 space-y-3">
          {visibleModules.map((campaignModule) => {
            const open = openModule === campaignModule.id;
            const panelId = `program-panel-${campaignModule.id}`;
            return <article key={campaignModule.id} id={`programme-${campaignModule.id}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-lux-line bg-white"><h3><button type="button" className="flex min-h-11 w-full items-start justify-between gap-4 p-5 text-left" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpenModule(open ? null : campaignModule.id); if (!open) track.preRentreeProgramViewed(toPreRentreeEntryLevel(campaignModule.level), campaignModule.subjectId.toLowerCase()); }}><span><span className="block font-semibold text-lux-ink">{campaignModule.title}</span><span className="mt-1 block text-sm font-normal text-lux-slate">{campaignModule.subtitle}</span></span><span aria-hidden="true">{open ? '−' : '+'}</span></button></h3><div id={panelId} role="region" aria-label={`Détail ${campaignModule.title}`} hidden={!open} className="border-t border-lux-line p-5"><dl className="grid gap-4 text-sm md:grid-cols-3"><div><dt className="font-semibold text-lux-ink">Prérequis</dt><dd className="mt-1 text-lux-slate">{campaignModule.prerequisites}</dd></div><div><dt className="font-semibold text-lux-ink">Différenciation</dt><dd className="mt-1 text-lux-slate">{campaignModule.differentiation}</dd></div><div><dt className="font-semibold text-lux-ink">Évaluation rapide</dt><dd className="mt-1 text-lux-slate">{campaignModule.quickAssessment}</dd></div></dl><ol className="mt-6 space-y-5">{campaignModule.sessions.map((session) => <li key={session.number} className="rounded-xl bg-lux-paper p-4"><h4 className="font-semibold text-lux-ink">Séance {session.number} · {session.title}</h4><p className="mt-2 text-sm text-lux-slate"><strong>Objectif :</strong> {session.objective}</p><p className="mt-2 text-sm text-lux-slate"><strong>Notions :</strong> {session.topics.join(' · ')}</p><p className="mt-2 text-sm text-lux-slate"><strong>Méthode et activité :</strong> {session.method}</p><p className="mt-2 text-sm text-lux-slate"><strong>Livrable :</strong> {session.deliverable}</p></li>)}</ol></div></article>;
          })}
        </div>
      </div>
    </section>
  );
}
