'use client';

import { useState } from 'react';
import { LEGAL } from '@/lib/legal';
import { useRouter } from 'next/navigation';

import { normalizeParentPhone } from '@/lib/contact/parent-phone';

type ChildDraft = Readonly<{ firstName: string; grade: string }>;
type DuplicateResolution =
  | Readonly<{ mode: 'ATTACH'; parentUserId: string }>
  | Readonly<{ mode: 'CREATE_NEW' }>;
type DuplicateCandidate = Readonly<{
  parentUserId: string;
  parentName: string;
  phone: string | null;
  children: readonly Readonly<{ studentId: string; studentName: string; gradeLevel: string }>[];
}>;

const GRADES = ['Quatrième', 'Troisième', 'Seconde', 'Première', 'Terminale'] as const;

/** Doit rester aligné sur `PAPER_ENTRY_MAX_CHILDREN` côté route. */
const MAX_CHILDREN = 6;

const EMPTY_CHILD: ChildDraft = { firstName: '', grade: 'Seconde' };

function newIdempotencyKey(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `foyer-papier-${suffix}`;
}

/**
 * Création du foyer préalable à une saisie.
 *
 * Le téléphone est obligatoire et permet de créer le foyer avant de connaître
 * l'e-mail. Aucun mot de passe n'est saisi ici : l'activation et la diffusion
 * restent en attente jusqu'à la complétion du contact parent.
 */
export function PaperEntryFamilyForm() {
  const router = useRouter();
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [children, setChildren] = useState<readonly ChildDraft[]>([EMPTY_CHILD]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<readonly DuplicateCandidate[]>([]);
  // Une seule clé pour ce foyer : un renvoi après un échec ambigu rejoue la
  // même création au lieu d'en ajouter une seconde.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  let phoneIsValid = false;
  try {
    normalizeParentPhone(parentPhone);
    phoneIsValid = true;
  } catch {
    phoneIsValid = false;
  }
  const complete = phoneIsValid
    && parentFirstName.trim().length > 0
    && parentLastName.trim().length > 0
    && children.every((child) => child.firstName.trim().length > 0);

  function updateChild(index: number, patch: Partial<ChildDraft>) {
    setChildren((current) => current.map((child, position) => (
      position === index ? { ...child, ...patch } : child
    )));
  }

  async function submit(duplicateResolution?: DuplicateResolution) {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/bilans/saisie-papier/famille', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({
          ...(parentEmail.trim() === '' ? {} : { parentEmail: parentEmail.trim() }),
          parentPhone: parentPhone.trim(),
          parentFirstName: parentFirstName.trim(),
          parentLastName: parentLastName.trim(),
          ...(duplicateResolution === undefined ? {} : { duplicateResolution }),
          children: children.map((child) => ({
            firstName: child.firstName.trim(),
            grade: child.grade,
          })),
        }),
      });
      if (response.status === 409) {
        const conflict = await response.json() as {
          error?: Readonly<{ code?: string }>;
          candidates?: readonly DuplicateCandidate[];
        };
        if (conflict.error?.code === 'POTENTIAL_DUPLICATE' && conflict.candidates !== undefined) {
          setCandidates(conflict.candidates);
          setIdempotencyKey(newIdempotencyKey());
          return;
        }
      }
      if (!response.ok) throw new Error('FAMILY_CREATE_FAILED');
      const created = await response.json() as { children?: ReadonlyArray<{ studentId: string }> };
      const first = created.children?.[0]?.studentId;
      router.replace(first === undefined
        ? '/dashboard/assistante/bilans/saisie-papier'
        : `/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(first)}`);
      router.refresh();
    } catch {
      setError('Le foyer n’a pas pu être créé. Vérifiez le téléphone et les coordonnées, puis réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-300">Prénom du parent</span>
          <input
            value={parentFirstName}
            onChange={(event) => setParentFirstName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-300">Nom du parent</span>
          <input
            value={parentLastName}
            onChange={(event) => setParentLastName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-300">Téléphone du parent</span>
          <input
            type="tel"
            inputMode="tel"
            required
            value={parentPhone}
            onChange={(event) => setParentPhone(event.target.value)}
            placeholder={LEGAL.contact.phone}
            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-300">E-mail du parent (facultatif)</span>
          <input
            type="email"
            value={parentEmail}
            onChange={(event) => setParentEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
      </div>

      <p className="text-sm text-slate-400">
        Sans e-mail, le bilan peut être saisi et généré. L'accès parent et la diffusion seront débloqués après sa complétion.
      </p>

      <ul className="space-y-3">
        {children.map((child, index) => (
          // Les enfants n'ont pas d'identité stable avant création ; la
          // position dans le brouillon est la seule clé disponible.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm">
              <span className="text-slate-300">Prénom de l’enfant</span>
              <input
                value={child.firstName}
                onChange={(event) => updateChild(index, { firstName: event.target.value })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-300">Niveau</span>
              <select
                value={child.grade}
                onChange={(event) => updateChild(index, { grade: event.target.value })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
              >
                {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </label>
            {children.length > 1 && (
              <button
                type="button"
                onClick={() => setChildren((current) => current.filter((_, position) => position !== index))}
                className="self-end rounded-xl border border-white/20 px-3 py-2 text-sm text-slate-300"
              >
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={children.length >= MAX_CHILDREN}
          onClick={() => setChildren((current) => (
            current.length >= MAX_CHILDREN ? current : [...current, EMPTY_CHILD]
          ))}
          className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ajouter un enfant
        </button>
        <button
          type="button"
          disabled={!complete || submitting}
          onClick={() => void submit()}
          className="rounded-xl bg-amber-400 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Création…' : 'Créer le foyer et continuer'}
        </button>
      </div>

      {candidates.length > 0 && (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4" aria-label="Foyers similaires">
          <h3 className="font-semibold text-amber-100">Ce foyer existe peut-être déjà — rattacher ?</h3>
          <p className="mt-1 text-sm text-slate-300">Vérifiez les informations puis choisissez explicitement.</p>
          <ul className="mt-3 space-y-3">
            {candidates.map((candidate) => (
              <li key={candidate.parentUserId} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p className="font-semibold text-white">{candidate.parentName}</p>
                <p className="text-sm text-slate-300">
                  {candidate.phone ?? 'Téléphone non affiché'}
                  {candidate.children.map((child) => ` · ${child.studentName} (${child.gradeLevel})`).join('')}
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit({ mode: 'ATTACH', parentUserId: candidate.parentUserId })}
                  className="mt-3 rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-40"
                >
                  Rattacher à {candidate.parentName}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit({ mode: 'CREATE_NEW' })}
            className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
          >
            Créer un nouveau foyer
          </button>
        </section>
      )}

      {children.length >= MAX_CHILDREN && (
        <p className="text-sm text-slate-400">
          Six enfants au maximum par création. Créez le foyer, puis ajoutez les suivants.
        </p>
      )}

      {error !== null && (
        <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>
      )}
    </div>
  );
}
