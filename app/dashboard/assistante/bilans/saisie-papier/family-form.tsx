'use client';

import { useState } from 'react';
import { LEGAL } from '@/lib/legal';
import { useRouter } from 'next/navigation';

import { normalizeParentPhone } from '@/lib/contact/parent-phone';

type ChildDraft = Readonly<{ firstName: string; grade: string }>;
type DuplicateResolution =
  | Readonly<{ mode: 'ATTACH'; parentUserId: string; confirmed?: true }>
  | Readonly<{ mode: 'CREATE_NEW' }>;
type MatchStrength = 'PHONE' | 'NAME_AND_LEVEL' | 'NAME_ONLY';
type DuplicateCandidate = Readonly<{
  parentUserId: string;
  parentName: string;
  phone: string | null;
  matchStrength: MatchStrength;
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
  // Téléphone tel que saisi, renvoyé par le serveur, pour montrer la divergence
  // avec le numéro d'un foyer homonyme.
  const [enteredPhone, setEnteredPhone] = useState('');
  // Rattachements sur signal faible cochés « je confirme » : le bouton reste
  // inerte tant que la case ne l'est pas.
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(new Set());
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
          enteredPhone?: string;
          candidates?: readonly DuplicateCandidate[];
        };
        if (conflict.error?.code === 'POTENTIAL_DUPLICATE' && conflict.candidates !== undefined) {
          setCandidates(conflict.candidates);
          setEnteredPhone(conflict.enteredPhone ?? parentPhone.trim());
          setConfirmedIds(new Set());
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
        <div className="text-sm">
          <label>
            <span className="text-slate-300">Téléphone du parent</span>
            <input
              type="tel"
              inputMode="tel"
              required
              value={parentPhone}
              onChange={(event) => setParentPhone(event.target.value)}
              placeholder={LEGAL.contact.phone}
              aria-invalid={parentPhone.trim().length > 0 && !phoneIsValid}
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Numéros tunisiens et internationaux acceptés, par exemple +216… ou +974…
          </p>
          {parentPhone.trim().length > 0 && !phoneIsValid && (
            <p role="alert" className="mt-1 text-xs text-red-300">
              Numéro de téléphone invalide.
            </p>
          )}
        </div>
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
        Sans e-mail, le bilan peut être saisi, généré et diffusé au parent par WhatsApp (téléphone). L'e-mail
        reste utile pour lui ouvrir un accès en ligne (activation du compte) — il peut être ajouté plus tard.
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

      {candidates.length > 0 && (() => {
        const strongCandidates = candidates.filter((candidate) => candidate.matchStrength === 'PHONE');
        const homonymCandidates = candidates.filter((candidate) => candidate.matchStrength !== 'PHONE');
        const enteredName = `${parentFirstName.trim()} ${parentLastName.trim()}`.trim();

        function toggleConfirmed(parentUserId: string) {
          setConfirmedIds((current) => {
            const next = new Set(current);
            if (next.has(parentUserId)) next.delete(parentUserId);
            else next.add(parentUserId);
            return next;
          });
        }

        return (
          <div className="space-y-4" aria-label="Foyers similaires">
            {strongCandidates.length > 0 && (
              <section className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
                <h3 className="font-semibold text-emerald-100">Même téléphone — s’agit-il du même foyer&nbsp;?</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Un foyer existant porte le téléphone que vous avez saisi. Le rattachement est probablement légitime.
                </p>
                <ul className="mt-3 space-y-3">
                  {strongCandidates.map((candidate) => (
                    <li key={candidate.parentUserId} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <p className="font-semibold text-white">{candidate.parentName}</p>
                      <p className="text-sm text-slate-300">
                        {candidate.phone ?? 'Téléphone non enregistré'}
                        {candidate.children.map((child) => ` · ${child.studentName} (${child.gradeLevel})`).join('')}
                      </p>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void submit({ mode: 'ATTACH', parentUserId: candidate.parentUserId })}
                        className="mt-3 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                      >
                        Rattacher à {candidate.parentName}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {homonymCandidates.length > 0 && (
              <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4">
                <h3 className="font-semibold text-amber-100">Attention — un autre foyer porte ce nom</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Le téléphone diffère&nbsp;: il s’agit très probablement d’une famille homonyme. Dans le doute,
                  créez un nouveau foyer — c’est le choix par défaut.
                </p>
                <ul className="mt-3 space-y-3">
                  {homonymCandidates.map((candidate) => (
                    <li key={candidate.parentUserId} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <dt className="text-xs uppercase tracking-wide text-slate-400">Ce que vous saisissez</dt>
                          <dd className="mt-1 font-semibold text-white">{enteredName || 'Parent'}</dd>
                          <dd className="text-slate-300">{enteredPhone || 'Téléphone en cours de saisie'}</dd>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <dt className="text-xs uppercase tracking-wide text-slate-400">Foyer déjà enregistré</dt>
                          <dd className="mt-1 font-semibold text-white">{candidate.parentName}</dd>
                          <dd className="text-amber-200">{candidate.phone ?? 'Téléphone non enregistré'}</dd>
                          {candidate.children.length > 0 && (
                            <dd className="mt-1 text-slate-300">
                              {candidate.children.map((child) => `${child.studentName} (${child.gradeLevel})`).join(' · ')}
                            </dd>
                          )}
                        </div>
                      </dl>
                      <p className="mt-2 text-sm text-amber-100">
                        Le téléphone saisi ({enteredPhone || '—'}) diffère de celui de ce foyer
                        ({candidate.phone ?? 'non enregistré'}) — s’agit-il vraiment de la même famille&nbsp;?
                      </p>
                      <label className="mt-3 flex items-start gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={confirmedIds.has(candidate.parentUserId)}
                          onChange={() => toggleConfirmed(candidate.parentUserId)}
                          className="mt-0.5 h-4 w-4 rounded border-white/30 bg-slate-950"
                        />
                        <span>Je confirme qu’il s’agit bien du même foyer que {candidate.parentName}.</span>
                      </label>
                      <button
                        type="button"
                        disabled={submitting || !confirmedIds.has(candidate.parentUserId)}
                        onClick={() => void submit({ mode: 'ATTACH', parentUserId: candidate.parentUserId, confirmed: true })}
                        className="mt-3 rounded-xl border border-amber-300/60 px-3 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Rattacher malgré le téléphone différent
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit({ mode: 'CREATE_NEW' })}
              className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              Créer un nouveau foyer
            </button>
          </div>
        );
      })()}

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
