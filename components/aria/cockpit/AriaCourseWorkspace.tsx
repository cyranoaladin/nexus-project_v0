'use client';

/**
 * Espace de travail d'un cours.
 *
 * Affiche uniquement ce qui existe réellement : domaines et compétences issus
 * du skill graph compilé, ressources issues du Hub, bilans réels. Aucun
 * pourcentage de progression n'est affiché tant qu'aucune donnée de maîtrise
 * n'est persistée — c'est l'objet de P2.
 */

import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';
import { SUPPORT_LABELS, SUPPORT_TONE, ROLE_LABELS } from './support-labels';

interface AriaCourseWorkspaceProps {
  cockpit: AriaCockpitDTO;
  courseKey: string;
  onBack: () => void;
  onWorkWithAria: (courseKey: string) => void;
}

export function AriaCourseWorkspace({
  cockpit,
  courseKey,
  onBack,
  onWorkWithAria,
}: AriaCourseWorkspaceProps) {
  const view = cockpit.curriculum.courses.find((candidate) => candidate.course.key === courseKey);
  if (!view) {
    return (
      <EmptyState title="Cours introuvable" body="Ce cours ne fait pas partie de ta carte scolaire.">
        <Button onClick={onBack} variant="outline" size="sm">
          Revenir à ma carte
        </Button>
      </EmptyState>
    );
  }

  const { course, access } = view;
  const graph = cockpit.skillGraphs.find((candidate) => candidate.courseKey === courseKey) ?? null;
  const resources = cockpit.resources.filter((resource) => resource.courseKeys.includes(courseKey));
  const assessments = cockpit.assessments.filter(
    (assessment) => assessment.subject !== null && course.chatSubject === assessment.subject,
  );
  const canChat = course.chatSubject !== null && access.commerciallyEntitled;

  return (
    <section aria-labelledby="aria-workspace-title" className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-brand-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Ma carte scolaire
      </button>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader className="pb-3">
          <CardTitle id="aria-workspace-title" className="text-white">
            {course.label}
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-micro bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
              {ROLE_LABELS[course.role] ?? course.role}
            </span>
            <span className="rounded-micro bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
              {course.gradeLevel}
            </span>
            <span
              className={`rounded-micro px-2 py-0.5 text-[11px] font-medium ${SUPPORT_TONE[course.support]}`}
            >
              {SUPPORT_LABELS[course.support]}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {course.supportNote && <p className="text-sm text-neutral-400">{course.supportNote}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!canChat}
              onClick={() => onWorkWithAria(courseKey)}
              className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
              data-testid="aria-work-with-aria"
            >
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Travailler avec ARIA
            </Button>
            {!canChat && (
              <span className="self-center text-xs text-amber-200">
                {course.chatSubject === null
                  ? 'ARIA ne prend pas encore en charge cette matière.'
                  : "Cette matière n’est pas incluse dans ton abonnement."}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-neutral-200">Domaines et compétences</CardTitle>
        </CardHeader>
        <CardContent>
          {!graph ? (
            <EmptyState
              title="Pas encore de graphe de compétences"
              body="Le programme de cette matière n’a pas encore été découpé en compétences."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500">
                {graph.domains.length} domaines · {graph.competencies.length} compétences ·
                référentiel {graph.version}
              </p>
              {graph.domains.map((domain) => (
                <div key={domain.id}>
                  <p className="text-sm font-medium text-neutral-100">
                    {domain.label}{' '}
                    <span className="text-xs font-normal text-neutral-500">
                      ({domain.competencyCount})
                    </span>
                  </p>
                  <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {graph.competencies
                      .filter((competency) => competency.domainId === domain.domainId)
                      .map((competency) => (
                        <li
                          key={competency.id}
                          className="rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300"
                        >
                          {competency.label}
                          {competency.prerequisite && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-brand-accent">
                              prérequis
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
              <BookOpen className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Ressources de cette matière
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <EmptyState title="Aucune ressource rattachée" />
            ) : (
              <ul className="space-y-2">
                {resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.href ?? '#'}
                      className="block rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:border-brand-accent/40"
                    >
                      <span className="block text-sm text-neutral-100">{resource.title}</span>
                      {resource.subtitle && (
                        <span className="block text-xs text-neutral-500">{resource.subtitle}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-neutral-200">Bilans de cette matière</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <EmptyState title="Aucun bilan pour cette matière" />
            ) : (
              <ul className="space-y-2">
                {assessments.map((assessment) => (
                  <li
                    key={assessment.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <span className="block text-sm text-neutral-100">{assessment.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {assessment.date
                        ? new Date(assessment.date).toLocaleDateString('fr-FR')
                        : 'Date inconnue'}
                      {assessment.globalScore !== null ? ` · ${assessment.globalScore}/100` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
