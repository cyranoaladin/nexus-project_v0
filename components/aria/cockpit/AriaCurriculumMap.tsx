'use client';

/**
 * Carte scolaire de l'élève.
 *
 * Les cours sont regroupés par rôle (tronc commun / spécialités / modules de
 * voie / options) et chaque cours affiche honnêtement son état de support.
 * La liste vient exclusivement du catalogue curriculum : aucun composant ne
 * redéfinit sa propre liste de matières.
 */

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AriaCourseView, AriaCurriculumDTO } from '@/lib/aria/contracts';
import { AriaCourseCard } from './AriaCourseCard';
import { EmptyState } from './EmptyState';
import { ROLE_LABELS } from './support-labels';

const ROLE_ORDER = ['SPECIALTY', 'TRACK_MODULE', 'CORE', 'OPTION'] as const;

interface AriaCurriculumMapProps {
  curriculum: AriaCurriculumDTO;
  selectable?: boolean;
  onToggle?: (courseKey: string) => void;
  onOpen?: (courseKey: string) => void;
}

export function AriaCurriculumMap({
  curriculum,
  selectable = false,
  onToggle,
  onOpen,
}: AriaCurriculumMapProps) {
  if (curriculum.academicProfile.incomplete) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-100">Ton profil scolaire est incomplet</p>
            <p className="mt-1 text-sm text-amber-200/80">
              Il manque&nbsp;: {curriculum.academicProfile.missingFields.join(', ')}. Tant que ces
              informations manquent, ARIA ne peut pas construire ta carte scolaire.
            </p>
            <p className="mt-2 text-xs text-amber-200/60">
              Ces informations sont gérées par l’équipe Nexus&nbsp;: contacte ton assistante ou ton
              coach pour les faire corriger.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (curriculum.courses.length === 0) {
    return (
      <EmptyState
        title="Aucune matière connue pour ton profil"
        body="Ta classe et ta voie ne correspondent à aucun cours du catalogue actuel."
      />
    );
  }

  const grouped = new Map<string, AriaCourseView[]>();
  for (const view of curriculum.courses) {
    const bucket = grouped.get(view.course.role) ?? [];
    bucket.push(view);
    grouped.set(view.course.role, bucket);
  }

  return (
    <section id="aria-curriculum" aria-labelledby="aria-curriculum-title" className="space-y-6">
      <div>
        <h2 id="aria-curriculum-title" className="text-lg font-semibold text-neutral-100">
          Ma carte scolaire
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          {curriculum.courses.length} matière{curriculum.courses.length > 1 ? 's' : ''} ·{' '}
          {curriculum.availableCourseKeys.length} accessible
          {curriculum.availableCourseKeys.length > 1 ? 's' : ''} avec ARIA ·{' '}
          {curriculum.unsupportedCourseKeys.length} pas encore outillée
          {curriculum.unsupportedCourseKeys.length > 1 ? 's' : ''}
        </p>
      </div>

      {ROLE_ORDER.map((role) => {
        const views = grouped.get(role);
        if (!views || views.length === 0) return null;
        return (
          <Card key={role} className="border-white/10 bg-surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-neutral-200">
                {ROLE_LABELS[role] ?? role}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {views.map((view) => (
                  <AriaCourseCard
                    key={view.course.key}
                    view={view}
                    selectable={selectable}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
