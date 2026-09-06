'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { GRADE_LABELS } from '@/lib/assessments/core/config';
import type { Grade } from '@/lib/assessments/core/types';

export interface ParentRegistrationData {
  revision: string;
  firstName: string; lastName: string; phone: string | null; email: string | null; completedAt: string | null;
  children: Array<{ id: string; firstName: string; lastName: string; gradeLevel: string; academicTrack: string;
    school: string | null; schoolingStatus: string | null; consentVerified: boolean }>;
}
export interface ParentRegistrationInput {
  revision: string;
  firstName: string; lastName: string;
  children: Array<{ studentId: string; confirmed: true }>;
  consentStudentIds: string[];
}
const fieldClass = 'w-full rounded-lg border border-white/20 bg-surface-darker px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-accent';
export function ParentRegistrationForm({ data, onSubmit }: {
  data: ParentRegistrationData; onSubmit: (input: ParentRegistrationInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [consents, setConsents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = firstName.trim() && lastName.trim() && data.children.length > 0 && confirmed.length === data.children.length;
  const toggle = (values: string[], id: string, checked: boolean) => checked ? [...values, id] : values.filter(value => value !== id);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError(null);
    try {
      await onSubmit({ revision: data.revision, firstName: firstName.trim(), lastName: lastName.trim(), children: confirmed.map(studentId => ({ studentId, confirmed: true })), consentStudentIds: consents });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le dossier ne peut pas être confirmé. Veuillez réessayer.');
    } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-6">
    <Card className="border-white/10 bg-surface-card">
      <CardHeader><CardTitle className="text-white">Vos informations</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-neutral-200">Prénom<input value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" required maxLength={80} className={fieldClass} /></label>
          <label className="space-y-2 text-sm text-neutral-200">Nom<input value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" required maxLength={80} className={fieldClass} /></label>
        </div>
        <p className="text-sm text-neutral-300">WhatsApp : {data.phone || 'À confirmer avec l’assistante'}</p>
        {data.email && <p className="break-all text-sm text-neutral-300">Email : {data.email}</p>}
        <p className="text-sm text-neutral-300">Pour modifier votre numéro de connexion, contactez l’assistante afin de sécuriser le changement.</p>
      </CardContent>
    </Card>
    <section className="space-y-4" aria-labelledby="registration-children">
      <h2 id="registration-children" className="text-xl font-semibold text-white">Les enfants de votre dossier</h2>
      {data.children.length === 0 && <p className="text-neutral-300">Aucun enfant n’est encore rattaché. L’assistante vous aidera à compléter le dossier.</p>}
      {data.children.map(child => <Card key={child.id} className="border-white/10 bg-surface-card">
        <CardHeader><CardTitle className="text-lg text-white">{child.firstName} {child.lastName}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-neutral-300">
          <p>{GRADE_LABELS[child.gradeLevel as Grade] ?? child.gradeLevel.replaceAll('_', ' ')}{child.school ? ` · ${child.school}` : ''}</p>
          <p>{child.schoolingStatus === 'INDIVIDUAL' ? 'Candidat individuel — parcours à confirmer avec l’équipe pédagogique' : child.schoolingStatus === 'SCHOOL_ENROLLED' ? 'Accompagnement d’un élève scolarisé' : 'Situation scolaire à compléter avec l’assistante'}</p>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={confirmed.includes(child.id)} onChange={e => setConfirmed(toggle(confirmed, child.id, e.target.checked))} className="mt-1 h-4 w-4 shrink-0 accent-brand-accent" />
            <span>Je confirme les informations de {child.firstName} et son rattachement à mon dossier.</span>
          </label>
          {child.consentVerified ? <p className="text-emerald-300">Votre consentement au rattachement pour les bilans est déjà enregistré.</p> : <div className="space-y-2 border-t border-white/10 pt-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={consents.includes(child.id)} onChange={e => setConsents(toggle(consents, child.id, e.target.checked))} className="mt-1 h-4 w-4 shrink-0 accent-brand-accent" />
              <span>Je donne mon consentement explicite au rattachement de {child.firstName} pour consulter ses bilans publiés.</span>
            </label>
            <p className="text-xs text-neutral-300">Vous pouvez confirmer votre dossier maintenant et donner ce consentement ultérieurement depuis la fiche de l’enfant.</p>
          </div>}
        </CardContent>
      </Card>)}
    </section>
    <p className="text-sm text-neutral-300">Une information est incorrecte ou un enfant manque ? <a className="underline text-brand-accent" href={buildWhatsAppUrl('Je souhaite vérifier les informations de mon dossier familial.')} target="_blank" rel="noopener noreferrer">Contacter l’assistante</a>.</p>
    <p className="text-xs text-neutral-300">Vos données servent à gérer votre dossier et l’accompagnement. <a href="/politique-confidentialite" className="underline">Consulter la politique de confidentialité</a>.</p>
    {error && <p role="alert" className="rounded-lg border border-rose-400/30 p-3 text-rose-200">{error}</p>}
    <Button type="submit" disabled={!valid || saving} className="w-full sm:w-auto">{saving ? 'Enregistrement…' : 'Confirmer mon dossier'}</Button>
  </form>;
}
