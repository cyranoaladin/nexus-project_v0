'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { publicStageInscriptionSchema, type PublicStageInscriptionInput } from '@/lib/stages/inscription-schema';
import { formatStageDateRange, formatStagePrice } from '@/lib/stages/public';

const confirmationSchema = publicStageInscriptionSchema.extend({
  stageTermsAccepted: z.literal(true),
  dataProcessingAccepted: z.literal(true),
});

type ConfirmationData = PublicStageInscriptionInput & {
  stageTermsAccepted: boolean;
  dataProcessingAccepted: boolean;
};

type StageSummary = {
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  priceAmount: number;
  priceCurrency: string;
  isOpen: boolean;
};

const initialData: ConfirmationData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  level: 'Première',
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
  notes: '',
  stageTermsAccepted: false,
  dataProcessingAccepted: false,
};

const stepTitles = [
  "Informations de l'élève",
  'Parent / contact',
  'Récapitulatif',
];

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeFlatten = error as { fieldErrors?: Record<string, string[]> };
    const firstField = Object.values(maybeFlatten.fieldErrors ?? {}).flat()[0];
    if (firstField) return firstField;
  }
  return 'Veuillez vérifier les informations saisies.';
}

export function StageInscriptionForm({ stage }: { stage: StageSummary }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ConfirmationData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ email: string; status: string } | null>(null);

  const statusLabel = useMemo(() => {
    if (!success) return '';
    return success.status === 'WAITLISTED' ? "Liste d'attente" : 'En attente de confirmation';
  }, [success]);

  const updateField = <K extends keyof ConfirmationData>(key: K, value: ConfirmationData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const validateStep = () => {
    if (step === 0) {
      const result = publicStageInscriptionSchema.pick({
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        level: true,
      }).safeParse(formData);

      if (!result.success) {
        setError(getErrorMessage(result.error.flatten()));
        return false;
      }
    }

    if (step === 1) {
      const result = publicStageInscriptionSchema.pick({
        parentFirstName: true,
        parentLastName: true,
        parentEmail: true,
        parentPhone: true,
        notes: true,
      }).safeParse(formData);

      if (!result.success) {
        setError(getErrorMessage(result.error.flatten()));
        return false;
      }
    }

    if (step === 2) {
      const result = confirmationSchema.safeParse(formData);
      if (!result.success) {
        setError(getErrorMessage(result.error.flatten()));
        return false;
      }
    }

    return true;
  };

  const submit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/stages/${stage.slug}/inscrire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          level: formData.level,
          parentFirstName: formData.parentFirstName,
          parentLastName: formData.parentLastName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          notes: formData.notes,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 201) {
        setSuccess({
          email: formData.email,
          status: payload?.reservation?.status ?? 'PENDING',
        });
        return;
      }

      if (response.status === 409) {
        setError("Une inscription existe déjà pour cet email sur ce stage.");
        return;
      }

      if (response.status === 404) {
        setError('Les inscriptions pour ce stage sont fermées.');
        return;
      }

      setError(payload?.error ? getErrorMessage(payload.error) : 'Une erreur est survenue.');
    } catch {
      setError("Impossible d'envoyer l'inscription pour le moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-8 text-neutral-100">
        <div className="flex items-center gap-3 text-emerald-300">
          <CheckCircle2 className="h-8 w-8" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Inscription enregistrée !</h2>
            <p className="text-sm text-emerald-100">Votre demande a bien été transmise à notre équipe.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-surface-darker/60 p-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-neutral-500">Statut</p>
            <p className="mt-1 font-semibold text-white">{statusLabel}</p>
          </div>
          <div>
            <p className="text-neutral-500">Email de suivi</p>
            <p className="mt-1 font-semibold text-white">{success.email}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-neutral-200">
          Un email de confirmation vous a été envoyé à <strong>{success.email}</strong>. Notre équipe vous contactera dans les 24h pour les détails de paiement.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-surface-darker transition hover:bg-neutral-100">
            Retour à l&apos;accueil
          </Link>
          <Link href="/stages" className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Découvrir nos autres stages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
        {stepTitles.map((title, index) => {
          const active = index === step;
          const done = index < step;

          return (
            <div
              key={title}
              className={`rounded-2xl border px-4 py-3 transition-colors ${
                active
                  ? 'border-brand-accent/40 bg-brand-accent/10'
                  : done
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {done ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className={`h-4 w-4 ${active ? 'text-brand-accent' : 'text-neutral-500'}`} />}
                <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">Étape {index + 1}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{title}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Prénom" value={formData.firstName} onChange={(value) => updateField('firstName', value)} />
            <Field label="Nom" value={formData.lastName} onChange={(value) => updateField('lastName', value)} />
            <Field label="Email" type="email" value={formData.email} onChange={(value) => updateField('email', value)} />
            <Field label="Téléphone" type="tel" value={formData.phone ?? ''} onChange={(value) => updateField('phone', value)} />
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-200">Niveau</label>
              <select
                value={formData.level}
                onChange={(event) => updateField('level', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-surface-elevated px-4 py-3 text-sm text-white outline-none transition focus:border-brand-accent/50"
              >
                {['Première', 'Terminale', '3ème', 'Autre'].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-neutral-300">
              Ces informations permettent à notre équipe de vous contacter directement.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Prénom du parent" value={formData.parentFirstName ?? ''} onChange={(value) => updateField('parentFirstName', value)} />
              <Field label="Nom du parent" value={formData.parentLastName ?? ''} onChange={(value) => updateField('parentLastName', value)} />
              <Field label="Email du parent" type="email" value={formData.parentEmail ?? ''} onChange={(value) => updateField('parentEmail', value)} />
              <Field label="Téléphone du parent" type="tel" value={formData.parentPhone ?? ''} onChange={(value) => updateField('parentPhone', value)} />
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-neutral-200">Note complémentaire</label>
                <textarea
                  value={formData.notes ?? ''}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-surface-elevated px-4 py-3 text-sm text-white outline-none transition focus:border-brand-accent/50"
                  placeholder="Allergies, contraintes horaires, question à transmettre à l'équipe..."
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-white/10 bg-surface-darker/60 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Stage sélectionné</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{stage.title}</h3>
                  <p className="mt-1 text-sm text-neutral-300">{formatStageDateRange(stage.startDate, stage.endDate)}</p>
                </div>
                <p className="text-lg font-semibold text-white">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
              </div>
            </div>

            <div className="grid gap-4 text-sm text-neutral-200 md:grid-cols-2">
              <SummaryLine label="Élève" value={`${formData.firstName} ${formData.lastName}`} />
              <SummaryLine label="Email élève" value={formData.email} />
              <SummaryLine label="Téléphone élève" value={formData.phone || 'Non renseigné'} />
              <SummaryLine label="Niveau" value={formData.level} />
              <SummaryLine
                label="Parent"
                value={[formData.parentFirstName, formData.parentLastName].filter(Boolean).join(' ') || 'Non renseigné'}
              />
              <SummaryLine
                label="Contact parent"
                value={formData.parentEmail || formData.parentPhone || 'Non renseigné'}
              />
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-neutral-200">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.stageTermsAccepted}
                  onChange={(event) => updateField('stageTermsAccepted', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-surface-elevated"
                />
                <span>J&apos;ai pris connaissance des modalités du stage.</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.dataProcessingAccepted}
                  onChange={(event) => updateField('dataProcessingAccepted', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-surface-elevated"
                />
                <span>J&apos;accepte que mes données soient traitées par Nexus Réussite.</span>
              </label>
              <p className="text-xs text-neutral-500">
                Notre équipe vous contactera dans les 24h pour les détails de paiement.
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || submitting}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!validateStep()) return;
                  setStep(2);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
              >
                Passer cette étape
              </button>
            ) : null}

            {step < 2 ? (
              <button
                type="button"
                onClick={() => {
                  if (!validateStep()) return;
                  setStep((current) => Math.min(current + 1, 2));
                }}
                className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !stage.isOpen}
                className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmer mon inscription
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-200">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-surface-elevated px-4 py-3 text-sm text-white outline-none transition focus:border-brand-accent/50"
      />
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
