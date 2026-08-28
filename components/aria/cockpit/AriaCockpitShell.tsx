'use client';

/**
 * Coque du cockpit ARIA : en-tête, navigation, aiguillage des panneaux.
 *
 * Navigation mobile : grille qui passe à la ligne — jamais de défilement
 * horizontal (§19).
 */

import { useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  CompassIcon,
  LayoutGrid,
  MessageSquare,
  Sun,
} from 'lucide-react';
import type { AriaCockpitDTO, AriaCockpitPanel } from '@/lib/aria/contracts';
import { AriaTodayPanel } from './AriaTodayPanel';
import { AriaCurriculumMap } from './AriaCurriculumMap';
import { AriaCourseWorkspace } from './AriaCourseWorkspace';
import { AriaResourcesPanel } from './AriaResourcesPanel';
import { AriaTrajectoryPanel } from './AriaTrajectoryPanel';
import { AriaAssessmentsPanel } from './AriaAssessmentsPanel';
import { AriaAgentPanel } from './AriaAgentPanel';

const NAV: { panel: AriaCockpitPanel; label: string; icon: React.ElementType }[] = [
  { panel: 'TODAY', label: "Aujourd'hui", icon: Sun },
  { panel: 'CURRICULUM', label: 'Ma carte scolaire', icon: LayoutGrid },
  { panel: 'TRAJECTORY', label: 'Parcours', icon: CompassIcon },
  { panel: 'RESOURCES', label: 'Ressources', icon: BookOpen },
  { panel: 'ASSESSMENTS', label: 'Évaluations', icon: ClipboardCheck },
  { panel: 'ARIA', label: 'ARIA', icon: MessageSquare },
];

interface AriaCockpitShellProps {
  cockpit: AriaCockpitDTO;
  onOpenChat: (courseKey: string) => void;
  onToggleCourse: (courseKey: string) => void;
}

export function AriaCockpitShell({
  cockpit,
  onOpenChat,
  onToggleCourse,
}: AriaCockpitShellProps) {
  const [panel, setPanel] = useState<AriaCockpitPanel>(
    cockpit.profile.preferences.defaultPanel ?? 'TODAY',
  );
  const [openCourseKey, setOpenCourseKey] = useState<string | null>(null);

  function goToPanel(next: AriaCockpitPanel) {
    setPanel(next);
    setOpenCourseKey(null);
  }

  const student = cockpit.student;
  const displayName = [student.firstName, student.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-100">Cockpit ARIA</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {displayName ? `${displayName} · ` : ''}
          {student.gradeLevel ?? 'Classe inconnue'}
          {student.academicTrack ? ` · ${student.academicTrack}` : ''}
        </p>
      </header>

      <nav aria-label="Sections du cockpit">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          {NAV.map(({ panel: key, label, icon: Icon }) => {
            const active = panel === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => goToPanel(key)}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`aria-nav-${key}`}
                  className={`flex w-full items-center gap-2 rounded-micro border px-3 py-2 text-xs font-medium transition-colors lg:text-sm ${
                    active
                      ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                      : 'border-white/10 bg-surface-card text-neutral-300 hover:border-brand-accent/30 hover:text-brand-accent'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main>
        {panel === 'TODAY' && <AriaTodayPanel cockpit={cockpit} />}

        {panel === 'CURRICULUM' &&
          (openCourseKey ? (
            <AriaCourseWorkspace
              cockpit={cockpit}
              courseKey={openCourseKey}
              onBack={() => setOpenCourseKey(null)}
              onWorkWithAria={onOpenChat}
            />
          ) : (
            <AriaCurriculumMap
              curriculum={cockpit.curriculum}
              onOpen={setOpenCourseKey}
              onToggle={onToggleCourse}
            />
          ))}

        {panel === 'TRAJECTORY' && <AriaTrajectoryPanel cockpit={cockpit} />}
        {panel === 'RESOURCES' && <AriaResourcesPanel cockpit={cockpit} />}
        {panel === 'ASSESSMENTS' && <AriaAssessmentsPanel cockpit={cockpit} />}
        {panel === 'ARIA' && <AriaAgentPanel cockpit={cockpit} onOpenChat={onOpenChat} />}
      </main>
    </div>
  );
}
