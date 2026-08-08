'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ChildDraft = Readonly<{ firstName: string; grade: string }>;

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
 * L'adresse du parent est réelle — c'est par elle qu'il recevra son lien
 * d'activation, puis le bilan. Aucun mot de passe n'est saisi ici : le compte
 * reste en activation en attente jusqu'à ce que le parent pose le sien.
 */
export function PaperEntryFamilyForm() {
  const router = useRouter();
  const [parentEmail, setParentEmail] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [children, setChildren] = useState<readonly ChildDraft[]>([EMPTY_CHILD]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Une seule clé pour ce foyer : un renvoi après un échec ambigu rejoue la
  // même création au lieu d'en ajouter une seconde.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const complete = parentEmail.trim().length > 0
    && parentFirstName.trim().length > 0
    && parentLastName.trim().length > 0
    && children.every((child) => child.firstName.trim().length > 0);

  function updateChild(index: number, patch: Partial<ChildDraft>) {
    setChildren((current) => current.map((child, position) => (
      position === index ? { ...child, ...patch } : child
    )));
  }

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/bilans/saisie-papier/famille', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({
          parentEmail: parentEmail.trim(),
          parentFirstName: parentFirstName.trim(),
          parentLastName: parentLastName.trim(),
          children: children.map((child) => ({
            firstName: child.firstName.trim(),
            grade: child.grade,
          })),
        }),
      });
      if (!response.ok) throw new Error('FAMILY_CREATE_FAILED');
      const created = await response.json() as { children?: ReadonlyArray<{ studentId: string }> };
      const first = created.children?.[0]?.studentId;
      router.replace(first === undefined
        ? '/dashboard/assistante/bilans/saisie-papier'
        : `/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(first)}`);
      router.refresh();
    } catch {
      setError("Le foyer n’a pas pu être créé. Vérifiez l’adresse du parent, puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
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
          <span className="text-slate-300">Adresse du parent</span>
          <input
            type="email"
            value={parentEmail}
            onChange={(event) => setParentEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
      </div>

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
