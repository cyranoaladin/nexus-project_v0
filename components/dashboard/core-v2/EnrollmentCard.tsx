'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AssignmentDetail, type CoachSummary, type EnrollmentDetail, describeFailure, displayName, v2 } from './api';
import { isStaleConflict, useAction } from './actions';
import { StatusMessage } from './StatusMessage';
import { AcademicMapFields } from './StudentsSection';

const ENROLLMENT_LABEL: Record<EnrollmentDetail['status'], string> = { PENDING: 'En attente', ACTIVE: 'Active', COMPLETED: 'Terminée', WITHDRAWN: 'Retirée' };

export function EnrollmentCard({ enrollment, coaches, can, refresh }: { enrollment: EnrollmentDetail; coaches: CoachSummary[]; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  const action = useAction(refresh);
  const editable = enrollment.status === 'PENDING' || enrollment.status === 'ACTIVE';
  return (
    <article aria-label={`Inscription ${enrollment.academicYear.startYear}-${enrollment.academicYear.startYear + 1}`} className="rounded-md border border-white/10 bg-surface-darker p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-100">
            {enrollment.academicYear.startYear}-{enrollment.academicYear.startYear + 1} · <span className="text-brand-accent">{ENROLLMENT_LABEL[enrollment.status]}</span>
          </p>
          <p className="text-sm text-neutral-400">
            {enrollment.gradeLevel} · {enrollment.academicTrack}
            {enrollment.stmgPathway && ` · ${enrollment.stmgPathway}`}
            {enrollment.school && ` · ${enrollment.school}`}
            {enrollment.academicRevision > 0 && ` · révision ${enrollment.academicRevision}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('ENROLLMENT_APPROVE') && enrollment.status === 'PENDING' && (
            <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run('approve', () => v2(`/staff/enrollments/${enrollment.id}/approve`, { method: 'POST' }), 'Inscription approuvée.')}>
              Approuver
            </Button>
          )}
          {can('STUDENT_EDIT') && editable && <AcademicMapDialog enrollment={enrollment} onDone={refresh} />}
          {can('ENROLLMENT_WITHDRAW') && editable && (
            <Button type="button" size="sm" variant="outline" className="border-red-500/40 text-red-200 hover:text-red-100" disabled={action.pending !== null} onClick={() => void action.run('withdraw', () => v2(`/staff/enrollments/${enrollment.id}/withdraw`, { method: 'POST' }), 'Inscription retirée ; les affectations actives sont terminées.')}>
              Retirer
            </Button>
          )}
        </div>
      </div>
      {action.failure && (
        <div className="mt-2">
          <StatusMessage kind="error">
            {describeFailure(action.failure)}
            {isStaleConflict(action.failure) && ' — l’état affiché a été rechargé.'}
          </StatusMessage>
        </div>
      )}
      {action.success && (
        <div className="mt-2">
          <StatusMessage kind="success">{action.success}</StatusMessage>
        </div>
      )}

      <CoursesEditor enrollment={enrollment} editable={editable && can('COURSE_MANAGE')} onDone={refresh} />
      <AssignmentsPanel enrollment={enrollment} coaches={coaches} can={can} refresh={refresh} />
    </article>
  );
}

function AcademicMapDialog({ enrollment, onDone }: { enrollment: EnrollmentDetail; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState({ gradeLevel: enrollment.gradeLevel, academicTrack: enrollment.academicTrack, stmgPathway: enrollment.stmgPathway ?? '', school: enrollment.school ?? '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">Niveau / voie</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger le niveau, la voie ou la spécialité</DialogTitle>
          <DialogDescription>Correction de l’année en cours uniquement — une nouvelle année est une nouvelle inscription.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void action.run('map', () => v2(`/staff/enrollments/${enrollment.id}/academic-map`, { method: 'PUT', json: { gradeLevel: map.gradeLevel, academicTrack: map.academicTrack, stmgPathway: map.stmgPathway || null, school: map.school || null } }), 'Carte académique corrigée.');
          }}
        >
          <AcademicMapFields idPrefix={`map-${enrollment.id}`} value={map} onChange={setMap} />
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CoursesEditor({ enrollment, editable, onDone }: { enrollment: EnrollmentDetail; editable: boolean; onDone: () => Promise<void> }) {
  const [draft, setDraft] = useState(enrollment.courses.map((c) => ({ courseKey: c.courseKey, kind: c.kind })));
  const [newKey, setNewKey] = useState('');
  const [newKind, setNewKind] = useState<'SPECIALTY' | 'OPTION'>('SPECIALTY');
  const action = useAction(onDone);
  const dirty = JSON.stringify(draft) !== JSON.stringify(enrollment.courses.map((c) => ({ courseKey: c.courseKey, kind: c.kind })));

  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-sm font-medium text-neutral-200">Cours choisis</h4>
      {draft.length === 0 ? (
        <p role="status" className="text-sm text-neutral-400">Aucun cours explicite (spécialité / option).</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {draft.map((course) => (
            <li key={course.courseKey} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-100">
              {course.courseKey} <span className="text-neutral-400">({course.kind === 'SPECIALTY' ? 'spécialité' : 'option'})</span>
              {editable && (
                <button type="button" className="ml-1 text-neutral-400 hover:text-white" aria-label={`Retirer ${course.courseKey}`} onClick={() => setDraft(draft.filter((c) => c.courseKey !== course.courseKey))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="flex flex-wrap items-end gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const key = newKey.trim().toLowerCase();
            if (!key || draft.some((c) => c.courseKey === key)) return;
            setDraft([...draft, { courseKey: key, kind: newKind }]);
            setNewKey('');
          }}
        >
          <div>
            <Label htmlFor={`course-key-${enrollment.id}`}>Clé de cours</Label>
            <Input id={`course-key-${enrollment.id}`} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="maths-premiere" />
          </div>
          <div>
            <Label htmlFor={`course-kind-${enrollment.id}`}>Type</Label>
            <select id={`course-kind-${enrollment.id}`} className="rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={newKind} onChange={(e) => setNewKind(e.target.value as 'SPECIALTY' | 'OPTION')}>
              <option value="SPECIALTY">Spécialité</option>
              <option value="OPTION">Option</option>
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline">Ajouter</Button>
          <Button type="button" size="sm" disabled={!dirty || action.pending !== null} onClick={() => void action.run('courses', () => v2(`/staff/enrollments/${enrollment.id}/courses`, { method: 'PUT', json: { courses: draft } }), 'Cours enregistrés.')}>
            {action.pending === 'courses' ? 'Enregistrement…' : 'Enregistrer les cours'}
          </Button>
        </form>
      )}
      {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
      {action.success && <StatusMessage kind="success">{action.success}</StatusMessage>}
    </div>
  );
}

function AssignmentsPanel({ enrollment, coaches, can, refresh }: { enrollment: EnrollmentDetail; coaches: CoachSummary[]; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  const action = useAction(refresh);
  const [courseKey, setCourseKey] = useState(enrollment.courses[0]?.courseKey ?? '');
  const [coachId, setCoachId] = useState('');
  const eligibleCoaches = coaches.filter((c) => c.capabilities.includes(courseKey));
  const active = enrollment.assignments.filter((a) => a.status === 'ACTIVE');
  const ended = enrollment.assignments.filter((a) => a.status !== 'ACTIVE');

  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-sm font-medium text-neutral-200">Coachs et planning</h4>
      {active.length === 0 && <p role="status" className="text-sm text-neutral-400">Aucun coach affecté.</p>}
      {active.map((assignment) => (
        <AssignmentRow key={assignment.id} assignment={assignment} can={can} refresh={refresh} />
      ))}
      {ended.length > 0 && (
        <p className="text-xs text-neutral-500">{ended.length} affectation(s) terminée(s) : {ended.map((a) => `${a.courseKey} (${displayName(a.coach.user)})`).join(', ')}</p>
      )}
      {can('COACH_ASSIGN') && enrollment.status === 'ACTIVE' && enrollment.courses.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!coachId || !courseKey) return;
            void action.run('assign', () => v2('/staff/assignments', { method: 'POST', json: { coachId, enrollmentId: enrollment.id, courseKey } }), 'Coach affecté.');
          }}
        >
          <div>
            <Label htmlFor={`assign-course-${enrollment.id}`}>Cours</Label>
            <select id={`assign-course-${enrollment.id}`} className="rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={courseKey} onChange={(e) => { setCourseKey(e.target.value); setCoachId(''); }}>
              {enrollment.courses.map((c) => (
                <option key={c.courseKey} value={c.courseKey}>{c.courseKey}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`assign-coach-${enrollment.id}`}>Coach habilité</Label>
            <select id={`assign-coach-${enrollment.id}`} className="rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              <option value="">{eligibleCoaches.length === 0 ? 'Aucun coach habilité pour ce cours' : 'Choisir…'}</option>
              {eligibleCoaches.map((coach) => (
                <option key={coach.id} value={coach.id}>{displayName(coach.user)}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={!coachId || action.pending !== null}>{action.pending === 'assign' ? 'Affectation…' : 'Affecter'}</Button>
        </form>
      )}
      {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
      {action.success && <StatusMessage kind="success">{action.success}</StatusMessage>}
    </div>
  );
}

function AssignmentRow({ assignment, can, refresh }: { assignment: AssignmentDetail; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  const action = useAction(refresh);
  const openSeries = assignment.planningSeries.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  return (
    <div className="rounded border border-white/10 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-100">
          {assignment.courseKey} — {displayName(assignment.coach.user)} <span className="text-neutral-400">depuis le {assignment.startsAt.slice(0, 10)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {can('PLANNING_MANAGE') && <PlanningSeriesDialog assignment={assignment} onDone={refresh} />}
          {can('COACH_ASSIGN') && (
            <Button type="button" size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void action.run('end', () => v2(`/staff/assignments/${assignment.id}/end`, { method: 'POST' }), 'Affectation terminée ; ses séries de planning sont closes.')}>
              Terminer
            </Button>
          )}
        </div>
      </div>
      {openSeries.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-neutral-300">
          {openSeries.map((series) => (
            <li key={series.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {series.recurrenceRule} · {series.localStartTime}–{series.localEndTime} ({series.timezone}) · {series.status === 'PAUSED' ? 'en pause' : 'active'}
              </span>
              {can('PLANNING_MANAGE') && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={action.pending !== null}
                  onClick={() => void action.run(`end-series:${series.id}`, () => v2(`/staff/planning/series/${series.id}`, { method: 'PATCH', json: { expectedRevision: series.revision, changes: { status: 'ENDED' } } }), 'Série de planning terminée.')}
                >
                  Terminer la série
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {action.failure && (
        <div className="mt-2">
          <StatusMessage kind="error">
            {describeFailure(action.failure)}
            {isStaleConflict(action.failure) && ' — la série a été modifiée entre-temps ; l’état affiché a été rechargé.'}
          </StatusMessage>
        </div>
      )}
      {action.success && (
        <div className="mt-2">
          <StatusMessage kind="success">{action.success}</StatusMessage>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS: Array<[string, string]> = [['MO', 'Lundi'], ['TU', 'Mardi'], ['WE', 'Mercredi'], ['TH', 'Jeudi'], ['FR', 'Vendredi'], ['SA', 'Samedi'], ['SU', 'Dimanche']];

function PlanningSeriesDialog({ assignment, onDone }: { assignment: AssignmentDetail; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ startDate: '', localStartTime: '18:00', localEndTime: '19:00', day: 'MO', modality: 'ONLINE', location: '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">Planifier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle série hebdomadaire — {assignment.courseKey}</DialogTitle>
          <DialogDescription>Heures locales dans le fuseau de l’organisation (fixé par configuration, jamais présumé).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void action.run('series', () => v2('/staff/planning/series', { method: 'POST', json: { assignmentId: assignment.id, startDate: form.startDate, localStartTime: form.localStartTime, localEndTime: form.localEndTime, recurrenceRule: `FREQ=WEEKLY;BYDAY=${form.day}`, modality: form.modality, location: form.location || null } }), 'Série de planning créée.');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`series-start-${assignment.id}`}>Première séance</Label>
              <Input id={`series-start-${assignment.id}`} type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`series-day-${assignment.id}`}>Jour</Label>
              <select id={`series-day-${assignment.id}`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {WEEKDAYS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`series-from-${assignment.id}`}>Début</Label>
              <Input id={`series-from-${assignment.id}`} type="time" required value={form.localStartTime} onChange={(e) => setForm({ ...form, localStartTime: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`series-to-${assignment.id}`}>Fin</Label>
              <Input id={`series-to-${assignment.id}`} type="time" required value={form.localEndTime} onChange={(e) => setForm({ ...form, localEndTime: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`series-modality-${assignment.id}`}>Modalité</Label>
              <select id={`series-modality-${assignment.id}`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
                <option value="ONLINE">En ligne</option>
                <option value="IN_PERSON">Présentiel</option>
                <option value="HYBRID">Hybride</option>
              </select>
            </div>
            <div>
              <Label htmlFor={`series-location-${assignment.id}`}>Lieu (optionnel)</Label>
              <Input id={`series-location-${assignment.id}`} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Création…' : 'Créer la série'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
