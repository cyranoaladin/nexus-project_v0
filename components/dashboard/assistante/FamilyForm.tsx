'use client';

import { useState } from 'react';
import { LEGAL } from '@/lib/legal';
import { useRouter } from 'next/navigation';

import { ParentWhatsAppInvitation } from './ParentWhatsAppInvitation';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';

type ChildDraft = Readonly<{
  firstName: string; lastName?: string; grade: string;
  schoolingStatus?: 'SCHOOL_ENROLLED' | 'INDIVIDUAL'; school?: string;
}>;
type DuplicateResolution =
  | Readonly<{ mode: 'ATTACH'; parentUserId: string; confirmed?: true }>
  | Readonly<{ mode: 'CREATE_NEW' }>;
type MatchStrength = 'PHONE' | 'NAME_AND_LEVEL' | 'NAME_ONLY';
type DuplicateCandidate = Readonly<{
  parentUserId: string;
  parentName: string;
  phone: string | null;
  matchStrength: MatchStrength;
  phoneReservation?: Readonly<{ version: number; canRelease: boolean }>;
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

export type ExistingParentInfo = Readonly<{
  parentUserId: string;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail?: string | null;
}>;

/**
 * Création du foyer ou ajout d'enfant à un foyer existant, préalable à une saisie.
 *
 * Le téléphone est obligatoire et permet de créer le foyer avant de connaître
 * l'e-mail. Aucun mot de passe n'est saisi ici : l'activation et la diffusion
 * restent en attente jusqu'à la complétion du contact parent.
 */
export function FamilyForm({
  existingParent,
  mode = 'PAPER_ENTRY',
  onCreated,
}: Readonly<{
  existingParent?: ExistingParentInfo;
  mode?: 'PAPER_ENTRY' | 'WHATSAPP';
  onCreated?: () => void;
}> = {}) {
  const router = useRouter();
  const [parentEmail, setParentEmail] = useState(existingParent?.parentEmail ?? '');
  const [parentPhone, setParentPhone] = useState(existingParent?.parentPhone ?? '');
  const [parentFirstName, setParentFirstName] = useState(existingParent?.parentFirstName ?? '');
  const [parentLastName, setParentLastName] = useState(existingParent?.parentLastName ?? '');
  const [children, setChildren] = useState<readonly ChildDraft[]>([EMPTY_CHILD]);
  const [submitting, setSubmitting] = useState(false);
  const [createdFamily, setCreatedFamily] = useState<{ parentUserId: string; children: { studentId: string }[]; invitationQueued: boolean; invitationMode?: 'MANUAL' | 'AUTOMATIC'; invitationRequired?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<readonly DuplicateCandidate[]>([]);
  const [releaseConfirmedIds, setReleaseConfirmedIds] = useState<ReadonlySet<string>>(new Set());
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);
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
  let selectedParentMatches = false;
  if (existingParent && phoneIsValid) {
    try {
      selectedParentMatches = normalizeParentPhone(parentPhone).normalized === normalizeParentPhone(existingParent.parentPhone).normalized
        && parentFirstName.trim() === existingParent.parentFirstName.trim()
        && parentLastName.trim() === existingParent.parentLastName.trim()
        && parentEmail.trim().toLowerCase() === (existingParent.parentEmail ?? '').trim().toLowerCase();
    } catch { /* An incomplete historical contact must be confirmed explicitly. */ }
  }
  const complete = phoneIsValid
    && parentFirstName.trim().length > 0
    && parentLastName.trim().length > 0
    && children.every((child) => child.firstName.trim().length > 0 && (mode !== 'WHATSAPP' || Boolean(child.lastName?.trim())));

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
      const resolution = duplicateResolution ?? (existingParent && selectedParentMatches ? { mode: 'ATTACH', parentUserId: existingParent.parentUserId } : undefined);
      const response = await fetch(mode === 'WHATSAPP' ? '/api/assistante/families' : '/api/bilans/saisie-papier/famille', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({
          ...(parentEmail.trim() === '' ? {} : { parentEmail: parentEmail.trim() }),
          parentPhone: parentPhone.trim(),
          parentFirstName: parentFirstName.trim(),
          parentLastName: parentLastName.trim(),
          ...(resolution === undefined ? {} : { duplicateResolution: resolution }),
          children: children.map((child) => ({
            firstName: child.firstName.trim(),
            grade: child.grade,
            ...(mode === 'WHATSAPP' ? {
              lastName: child.lastName?.trim(),
              schoolingStatus: child.schoolingStatus,
              school: child.school?.trim() || undefined,
            } : {}),
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
          setReleaseConfirmedIds(new Set());
          setReservationNotice(null);
          setIdempotencyKey(newIdempotencyKey());
          return;
        }
      }
      if (!response.ok) throw new Error('FAMILY_CREATE_FAILED');
      const created = await response.json() as { parentUserId: string; children: { studentId: string }[]; invitationQueued: boolean; invitationMode?: 'MANUAL' | 'AUTOMATIC'; invitationRequired?: boolean };
      if (mode === 'WHATSAPP') {
        setCreatedFamily(created);
        onCreated?.();
        return;
      }
      const first = created.children?.[0]?.studentId;
      router.replace(first === undefined
        ? '/dashboard/assistante/bilans/saisie-papier'
        : `/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(first)}`);
      router.refresh();
    } catch {
      setError('Le foyer n’a pas pu être mis à jour. Vérifiez le téléphone et les coordonnées, puis réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  async function releaseReservation(candidate: DuplicateCandidate) {
    if (submitting || !candidate.phoneReservation?.canRelease || !releaseConfirmedIds.has(candidate.parentUserId)) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assistante/parents/${encodeURIComponent(candidate.parentUserId)}/phone-reservation/release`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedPhoneVersion: candidate.phoneReservation.version }),
      });
      if (!response.ok) throw new Error('RESERVATION_RELEASE_FAILED');
      setCandidates((current) => current.map((item) => item.parentUserId === candidate.parentUserId
        ? { ...item, phoneReservation: undefined } : item));
      setIdempotencyKey(newIdempotencyKey());
      setReservationNotice('Réservation libérée. Le foyer et ses enfants sont conservés. Vérifiez les informations avant de choisir un rattachement ou de créer un nouveau foyer.');
    } catch {
      setError('La réservation n’a pas pu être libérée. Vérifiez à nouveau le foyer : le parent a pu activer son compte ou renouveler son invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdFamily) return (
    <div role="status" className="space-y-4 rounded-xl border border-emerald-500/30 p-4 text-white">
      <p className="font-semibold">Foyer enregistré</p>
      <p>{createdFamily.invitationMode === 'MANUAL' && createdFamily.invitationRequired ? 'Le parent doit activer son accès puis compléter son inscription. Préparez son invitation ci-dessous.' : createdFamily.invitationQueued ? 'Invitation WhatsApp mise en file. Le parent vérifiera son numéro puis complétera son inscription.' : 'Les accès du parent sont conservés. Il pourra confirmer la nouvelle liste de ses enfants dans son espace.'}</p>
      {createdFamily.invitationQueued && <p className="text-sm text-slate-300">La mise en file ne confirme pas la réception du message.</p>}
      {createdFamily.invitationMode === 'MANUAL' && createdFamily.invitationRequired && <ParentWhatsAppInvitation parentUserId={createdFamily.parentUserId} />}
      {createdFamily.children.map((child, i) => <a key={child.studentId} href={`/dashboard/assistante/students/${child.studentId}`} className="block text-amber-200 underline">Ouvrir la fiche de {children[i]?.firstName || 'l’enfant'}</a>)}
      {createdFamily.children.map((child, i) => children[i]?.schoolingStatus === 'INDIVIDUAL' ? <a key={`candidate-${child.studentId}`} href={`/dashboard/assistante/students/${encodeURIComponent(child.studentId)}/candidat`} className="block text-amber-200 underline">Compléter le dossier candidat de {children[i]?.firstName}</a> : null)}
    </div>
  );

  return (
    <div className="mt-5 space-y-4">
      {existingParent && (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Foyer sélectionné</p>
          <p className="mt-1 font-semibold text-white">
            {existingParent.parentFirstName} {existingParent.parentLastName}
          </p>
          <p className="text-xs text-slate-300">
            {existingParent.parentPhone} {existingParent.parentEmail ? `· ${existingParent.parentEmail}` : ''}
          </p>
          <p className="mt-2 text-xs text-amber-100/90">
            Les enfants ci-dessous seront rattachés directement à ce foyer existant.
          </p>
        </div>
      )}

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
        {mode === 'WHATSAPP'
          ? 'Le parent reçoit une invitation WhatsApp pour vérifier son numéro et finaliser son inscription. Aucun mot de passe ni e-mail enfant n’est demandé ici.'
          : "Sans e-mail, le bilan peut être saisi, généré et diffusé au parent par WhatsApp (téléphone). L’e-mail peut être ajouté plus tard."}
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
            {mode === 'WHATSAPP' && <label className="text-sm">
              <span className="text-slate-300">Nom de l’enfant</span>
              <input required value={child.lastName ?? ''} onChange={event => updateChild(index, { lastName: event.target.value })} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white" />
            </label>}
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
            {mode === 'WHATSAPP' && (
              <div className="sm:col-span-3 space-y-3">
                <label className="block text-sm text-slate-300">Situation scolaire
                  <select value={child.schoolingStatus ?? ''} onChange={event => updateChild(index, { schoolingStatus: (event.target.value || undefined) as ChildDraft['schoolingStatus'] })} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white">
                    <option value="">À préciser avec la famille</option>
                    <option value="SCHOOL_ENROLLED">Élève scolarisé</option>
                    <option value="INDIVIDUAL">Candidat individuel</option>
                  </select>
                </label>
                {child.schoolingStatus === 'SCHOOL_ENROLLED' && <label className="block text-sm text-slate-300">Établissement (facultatif)
                  <input value={child.school ?? ''} onChange={event => updateChild(index, { school: event.target.value })} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white" />
                </label>}
                {child.schoolingStatus === 'INDIVIDUAL' && <p className="text-sm text-slate-400">Le projet bac sera renseigné dans le dossier candidat après création du foyer, lorsque ce service est disponible. Son objectif, sa session et sa situation antérieure doivent être confirmés avec la famille ; aucun parcours n’est déduit ici.</p>}

              </div>
            )}
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
          {submitting ? (existingParent ? 'Enregistrement…' : 'Création…') : (existingParent ? 'Ajouter l’enfant au foyer' : 'Créer le foyer et continuer')}
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
                  Un foyer existant porte ce téléphone. Vérifiez l’identité du parent et de ses enfants avant tout rattachement.
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
                      {mode === 'WHATSAPP' && candidate.phoneReservation?.canRelease && (
                        <div className="mt-3 border-t border-white/15 pt-3 text-sm text-slate-200">
                          <p>Ce numéro est réservé par une invitation expirée, sans activation du compte.</p>
                          <label className="mt-2 flex items-start gap-2">
                            <input type="checkbox" checked={releaseConfirmedIds.has(candidate.parentUserId)}
                              onChange={(event) => setReleaseConfirmedIds((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(candidate.parentUserId); else next.delete(candidate.parentUserId);
                                return next;
                              })} />
                            <span>Je confirme que cette réservation expirée doit être libérée. Le foyer et ses enfants seront conservés.</span>
                          </label>
                          <button type="button" disabled={submitting || !releaseConfirmedIds.has(candidate.parentUserId)}
                            onClick={() => void releaseReservation(candidate)}
                            className="mt-3 rounded-xl border border-amber-300/60 px-3 py-2 text-amber-100 disabled:opacity-40">
                            Libérer ce numéro réservé
                          </button>
                        </div>
                      )}
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
            {reservationNotice && <p role="status" className="text-sm text-amber-100">{reservationNotice}</p>}
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
