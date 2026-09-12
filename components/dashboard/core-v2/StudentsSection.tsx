'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACADEMIC_TRACKS, GRADE_LEVELS, STMG_PATHWAYS, type AcademicYear, type CoachSummary, type HouseholdDetail, type PublicUser, describeFailure, displayName, v2 } from './api';
import { AccountActions } from './AccountActions';
import { useAction } from './actions';
import { EnrollmentCard } from './EnrollmentCard';
import { StatusMessage } from './StatusMessage';

type Student = HouseholdDetail['students'][number];

export function StudentsSection({ household, years, coaches, can, refresh }: { household: HouseholdDetail; years: AcademicYear[]; coaches: CoachSummary[]; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  return (
    <Card className="border-white/10 bg-surface-dark">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-white">Élèves</CardTitle>
        {can('STUDENT_CREATE') && <CreateStudentDialog householdId={household.id} onDone={refresh} />}
      </CardHeader>
      <CardContent className="space-y-6">
        {household.students.length === 0 && <p role="status" className="text-neutral-400">Aucun élève dans ce foyer.</p>}
        {household.students.map((student) => (
          <StudentBlock key={student.id} student={student} years={years} coaches={coaches} can={can} refresh={refresh} />
        ))}
      </CardContent>
    </Card>
  );
}

function StudentBlock({ student, years, coaches, can, refresh }: { student: Student; years: AcademicYear[]; coaches: CoachSummary[]; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  const openYears = years.filter((y) => y.status !== 'CLOSED' && !student.enrollments.some((e) => e.academicYear.id === y.id));
  return (
    <section aria-labelledby={`student-${student.id}`} className="rounded-lg border border-white/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`student-${student.id}`} className="font-medium text-neutral-100">{displayName(student.user)}</h3>
          <p className="text-sm text-neutral-400">
            {student.user.email ?? 'sans e-mail'}
            {student.birthDate && ` · né(e) le ${student.birthDate.slice(0, 10)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('STUDENT_EDIT') && <CorrectStudentDialog student={student} onDone={refresh} />}
          {can('ENROLLMENT_CREATE') && openYears.length > 0 && <NewEnrollmentDialog student={student} years={openYears} onDone={refresh} />}
        </div>
      </div>
      <div className="mt-3">
        <AccountActions user={student.user} can={can} onChanged={refresh} />
      </div>
      <div className="mt-4 space-y-3">
        {student.enrollments.length === 0 ? (
          <p role="status" className="text-sm text-neutral-400">Aucune inscription annuelle.</p>
        ) : (
          student.enrollments.map((enrollment) => <EnrollmentCard key={enrollment.id} enrollment={enrollment} coaches={coaches} can={can} refresh={refresh} />)
        )}
      </div>
    </section>
  );
}

function CreateStudentDialog({ householdId, onDone }: { householdId: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', birthDate: '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">Ajouter un élève</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un élève</DialogTitle>
          <DialogDescription>Un compte élève est créé « à activer » ; l’invitation se fait ensuite depuis la fiche.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void action.run('create-student', () => v2('/staff/students', { method: 'POST', json: { householdId, student: { firstName: form.firstName, lastName: form.lastName, email: form.email || undefined, birthDate: form.birthDate || undefined } } }), 'Élève ajouté.');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-student-first-name">Prénom</Label>
              <Input id="new-student-first-name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="new-student-last-name">Nom</Label>
              <Input id="new-student-last-name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="new-student-email">E-mail (optionnel)</Label>
            <Input id="new-student-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="new-student-birth-date">Date de naissance (optionnel)</Label>
            <Input id="new-student-birth-date" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Ajout…' : 'Ajouter'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CorrectStudentDialog({ student, onDone }: { student: Student; onDone: () => Promise<void> }) {
  const user: PublicUser = student.user;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', email: user.email ?? '', birthDate: student.birthDate?.slice(0, 10) ?? '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">Corriger l’identité</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger l’identité de {displayName(user)}</DialogTitle>
          <DialogDescription>La correction est journalisée (champs modifiés, jamais les valeurs).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const changes: Record<string, string | null> = {};
            if (form.firstName !== (user.firstName ?? '')) changes.firstName = form.firstName;
            if (form.lastName !== (user.lastName ?? '')) changes.lastName = form.lastName;
            if (form.email !== (user.email ?? '')) changes.email = form.email || null;
            if (form.birthDate !== (student.birthDate?.slice(0, 10) ?? '')) changes.birthDate = form.birthDate || null;
            void action.run('correct-student', () => v2(`/staff/students/${student.id}`, { method: 'PATCH', json: changes }), 'Identité corrigée.');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`stu-first-${student.id}`}>Prénom</Label>
              <Input id={`stu-first-${student.id}`} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`stu-last-${student.id}`}>Nom</Label>
              <Input id={`stu-last-${student.id}`} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={`stu-email-${student.id}`}>E-mail</Label>
            <Input id={`stu-email-${student.id}`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={`stu-birth-${student.id}`}>Date de naissance</Label>
            <Input id={`stu-birth-${student.id}`} type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicMapFields({ idPrefix, value, onChange }: { idPrefix: string; value: { gradeLevel: string; academicTrack: string; stmgPathway: string; school: string }; onChange: (next: { gradeLevel: string; academicTrack: string; stmgPathway: string; school: string }) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-grade`}>Niveau</Label>
        <select id={`${idPrefix}-grade`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={value.gradeLevel} onChange={(e) => onChange({ ...value, gradeLevel: e.target.value })}>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-track`}>Voie</Label>
        <select id={`${idPrefix}-track`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={value.academicTrack} onChange={(e) => onChange({ ...value, academicTrack: e.target.value })}>
          {ACADEMIC_TRACKS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {value.academicTrack.startsWith('STMG') && (
        <div>
          <Label htmlFor={`${idPrefix}-pathway`}>Spécialité STMG</Label>
          <select id={`${idPrefix}-pathway`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={value.stmgPathway} onChange={(e) => onChange({ ...value, stmgPathway: e.target.value })}>
            <option value="">—</option>
            {STMG_PATHWAYS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label htmlFor={`${idPrefix}-school`}>Établissement (optionnel)</Label>
        <Input id={`${idPrefix}-school`} value={value.school} onChange={(e) => onChange({ ...value, school: e.target.value })} />
      </div>
    </div>
  );
}

function NewEnrollmentDialog({ student, years, onDone }: { student: Student; years: AcademicYear[]; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [yearId, setYearId] = useState(years[0]?.id ?? '');
  const [map, setMap] = useState({ gradeLevel: 'SECONDE', academicTrack: 'EDS_GENERALE', stmgPathway: '', school: '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">Nouvelle inscription</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inscrire {displayName(student.user)} pour une année</DialogTitle>
          <DialogDescription>L’inscription est créée « en attente » ; l’approbation est une action distincte.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void action.run('enroll', () => v2('/staff/enrollments', { method: 'POST', json: { studentId: student.id, academicYearId: yearId, academicMap: { gradeLevel: map.gradeLevel, academicTrack: map.academicTrack, stmgPathway: map.stmgPathway || undefined, school: map.school || undefined } } }), 'Inscription créée (en attente d’approbation).');
          }}
        >
          <div>
            <Label htmlFor={`enroll-year-${student.id}`}>Année scolaire</Label>
            <select id={`enroll-year-${student.id}`} className="w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.startYear}-{y.startYear + 1} ({y.status === 'CURRENT' ? 'en cours' : 'à venir'})</option>
              ))}
            </select>
          </div>
          <AcademicMapFields idPrefix={`enroll-${student.id}`} value={map} onChange={setMap} />
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Création…' : 'Créer l’inscription'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
