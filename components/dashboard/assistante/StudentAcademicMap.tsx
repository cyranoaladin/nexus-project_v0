'use client';

/**
 * Carte scolaire d'un élève, côté staff (ADMIN/ASSISTANTE).
 *
 * Deux sections, à dessein bien séparées :
 * - « Scolarité » : lecture seule, enseignements obligatoires (tronc commun +
 *   modules de voie) dérivés du couple (niveau × voie) courant — jamais un
 *   choix, donc jamais éditable ici.
 * - « Enseignements suivis » : les spécialités et options réellement suivies,
 *   éditables, mais uniquement parmi ce que le catalogue propose pour ce
 *   profil (`GET .../academic-enrollments`, qui délègue au catalogue
 *   versionné — `lib/curriculum/catalog.ts`) — jamais un champ texte libre.
 *
 * Ne modifie JAMAIS l'identité scolaire (niveau, voie, voie STMG, statut) :
 * hors périmètre de ce composant (Task 7 du plan) — voir la note dans son
 * fichier de tests.
 *
 * Concurrence : chaque enregistrement renvoie la révision qu'il a lue
 * (`expectedRevision`). Un 409 `ACADEMIC_REVISION_CONFLICT` (édition
 * concurrente) est traité explicitement — jamais silencieusement ignoré.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type CourseKind = 'CORE' | 'SPECIALTY' | 'OPTION' | 'TRACK_MODULE';
type AcademicStatus = 'ENROLLED' | 'DERIVED' | 'NOT_ENROLLED';

interface CourseView {
  course: { courseKey: string; label: string; kind: CourseKind };
  academicStatus: AcademicStatus;
  enrollmentSource: string | null;
}

interface AcademicMapResponse {
  success: true;
  studentId: string;
  gradeLevel: string;
  academicTrack: string;
  stmgPathway: string | null;
  schoolingStatus: string | null;
  academicRevision: number;
  courses: CourseView[];
}

interface StudentAcademicMapProps {
  studentId: string;
}

function isChoosable(view: CourseView): boolean {
  return view.course.kind === 'SPECIALTY' || view.course.kind === 'OPTION';
}

export function StudentAcademicMap({ studentId }: StudentAcademicMapProps) {
  const [data, setData] = useState<AcademicMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const applyMap = useCallback((map: AcademicMapResponse) => {
    setData(map);
    setSelected(
      new Set(
        map.courses
          .filter((view) => isChoosable(view) && view.academicStatus === 'ENROLLED')
          .map((view) => view.course.courseKey),
      ),
    );
    setConflict(false);
  }, []);

  const fetchMap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assistante/students/${studentId}/academic-enrollments`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      applyMap(body as AcademicMapResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [studentId, applyMap]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  const toggleCourse = (courseKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseKey)) {
        next.delete(courseKey);
      } else {
        next.add(courseKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/assistante/students/${studentId}/academic-enrollments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseKeys: Array.from(selected),
          expectedRevision: data.academicRevision,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (body?.error === 'ACADEMIC_REVISION_CONFLICT') {
          setConflict(true);
          toast.error('La fiche scolaire a été modifiée entre-temps. Rechargez avant de réessayer.');
          return;
        }
        const issues: string[] | undefined = body?.details?.issues;
        throw new Error(issues?.join(' ; ') || body?.message || body?.error || `HTTP ${res.status}`);
      }

      applyMap(body as AcademicMapResponse);
      toast.success('Enseignements suivis mis à jour.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-surface-card border border-white/10 shadow-premium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-accent" data-testid="academic-map-loading" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-surface-card border border-white/10 shadow-premium">
        <CardContent className="space-y-3 py-4">
          <p className="text-sm text-rose-200">{error || 'Carte scolaire indisponible'}</p>
          <Button
            onClick={fetchMap}
            variant="outline"
            className="border-white/10 text-neutral-200 hover:text-white"
          >
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const mandatoryCourses = data.courses.filter((view) => view.academicStatus === 'DERIVED');
  const choosableCourses = data.courses.filter(isChoosable);

  return (
    <div className="space-y-6">
      <Card className="bg-surface-card border border-white/10 shadow-premium">
        <CardHeader>
          <CardTitle className="text-white text-base">Scolarité</CardTitle>
        </CardHeader>
        <CardContent>
          {mandatoryCourses.length === 0 ? (
            <p className="text-sm text-neutral-400">Aucun enseignement obligatoire identifié pour ce profil.</p>
          ) : (
            <ul className="space-y-1">
              {mandatoryCourses.map((view) => (
                <li
                  key={view.course.courseKey}
                  className="flex items-center justify-between text-sm text-neutral-200"
                >
                  <span>{view.course.label}</span>
                  <Badge variant="outline" className="border-white/10 text-neutral-400">
                    Obligatoire
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-card border border-white/10 shadow-premium">
        <CardHeader>
          <CardTitle className="text-white text-base">Enseignements suivis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conflict && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"
            >
              <span>Cette fiche a été modifiée entre-temps. Rechargez avant de continuer.</span>
              <Button size="sm" onClick={fetchMap} className="btn-primary">
                Recharger
              </Button>
            </div>
          )}

          {choosableCourses.length === 0 ? (
            <p className="text-sm text-neutral-400">Aucune spécialité ou option proposable pour ce profil.</p>
          ) : (
            <ul className="space-y-2">
              {choosableCourses.map((view) => {
                const inputId = `academic-course-${view.course.courseKey}`;
                return (
                  <li key={view.course.courseKey} className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(view.course.courseKey)}
                      disabled={saving}
                      onChange={() => toggleCourse(view.course.courseKey)}
                    />
                    <label htmlFor={inputId} className="text-sm text-neutral-200">
                      {view.course.label}
                      <span className="ml-1 text-xs text-neutral-500">
                        ({view.course.kind === 'SPECIALTY' ? 'Spécialité' : 'Option'})
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || conflict} className="btn-primary">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default StudentAcademicMap;
