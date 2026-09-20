'use client';

import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type ApiFail, type DuplicateReport, type HouseholdSummary, type Page, type PublicUser, describeFailure, displayName, v2 } from './api';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

const ACCOUNT_LABEL: Record<PublicUser['accountStatus'], string> = {
  PENDING_ACTIVATION: 'En attente d’activation',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  DISABLED: 'Désactivé',
};

const ACCOUNT_BADGE_VARIANT: Record<PublicUser['accountStatus'], BadgeProps['variant']> = {
  PENDING_ACTIVATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'destructive',
  DISABLED: 'outline',
};

/**
 * The API exposes only the four PublicUser.accountStatus values — no
 * invitation-sent/expired timestamp. "Invitation non encore émise" and
 * "invitation expirée" (go-live mission §3) are therefore not
 * distinguishable from this data without a backend change; showing them
 * as two different UI states here would invent information the API does
 * not carry. What IS real and available: how long a PENDING_ACTIVATION
 * account has been waiting, from its own createdAt — surfaced as the one
 * actionable signal this data actually supports.
 */
/**
 * `createdAt` is when the account row was created, not proof an invitation
 * was sent — and "depuis N j" derived from it invents a delay that may not
 * exist (review, correctly: a duration under 24h can straddle midnight and
 * read as "hier" one minute and "aujourd'hui" the next, in whichever
 * timezone happens to be ambient). Replaced with the one fact this field
 * actually is: the date the account was created, in the organization's own
 * timezone — never the viewer's browser zone, which review also verified
 * this used to silently depend on.
 */
/** `null` return means the date is missing/invalid — the caller renders a
 * standalone anomaly sentence instead of gluing it onto "Compte créé le". */
function formatAccountCreatedAt(createdAt: string, organizationTimezone: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: organizationTimezone,
  }).format(date);
}

function AccountStatusBadge({ user, organizationTimezone }: { user: PublicUser; organizationTimezone: string }) {
  const createdAtLabel = user.accountStatus === 'PENDING_ACTIVATION'
    ? formatAccountCreatedAt(user.createdAt, organizationTimezone)
    : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={ACCOUNT_BADGE_VARIANT[user.accountStatus]}>{ACCOUNT_LABEL[user.accountStatus]}</Badge>
      {user.accountStatus === 'PENDING_ACTIVATION' && (
        <span className="text-xs text-neutral-400">
          {createdAtLabel ? `Compte créé le ${createdAtLabel}` : 'Date de création inconnue'}
        </span>
      )}
    </span>
  );
}

export function HouseholdsWorkspace({ basePath, organizationTimezone }: { basePath: string; organizationTimezone: string }) {
  const { can, failure: actorFailure, loading: actorLoading } = useStaffActor();
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<HouseholdSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const load = useCallback(async (cursor: string | null) => {
    const requestId = ++latest.current;
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setFailure(null);
    const params = new URLSearchParams({ limit: '20' });
    if (query) params.set('q', query);
    if (cursor) params.set('cursor', cursor);
    const result = await v2<Page<HouseholdSummary>>(`/staff/households?${params.toString()}`);
    if (requestId !== latest.current) return;
    if (result.ok) {
      setItems((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
      setNextCursor(result.data.nextCursor);
    } else {
      setFailure(result);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [query]);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="core-v2 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Familles</h1>
          <p className="text-sm text-neutral-400">Foyers, contacts parents, élèves et inscriptions — recherchez une famille ou ouvrez sa fiche.</p>
        </div>
        {/*
          Was a plain `flex` row with no wrap: on a narrow viewport (measured
          at 390px CSS width) the third button ("Nouvelle famille") ran past
          the visible edge — the outer header's own flex-wrap only lets this
          whole block drop below the title, it does nothing for overflow
          inside the block itself. flex-wrap here lets the 3 actions break
          onto their own line(s) instead of overflowing; w-full sm:w-auto
          keeps each button a full-width, easily-tappable target on the
          narrowest screens rather than three cramped fragments.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`${basePath}/annees`}>Années scolaires</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`${basePath}/planning`}>Planning</Link>
          </Button>
          {can('HOUSEHOLD_CREATE') && <CreateHouseholdDialog basePath={basePath} onCreated={() => void load(null)} />}
        </div>
      </header>

      {actorFailure && <StatusMessage kind="error">{describeFailure(actorFailure)}</StatusMessage>}

      <Card className="border-white/10 bg-surface-dark">
        <CardHeader>
          <h2 className="text-base font-semibold text-white">
            <label htmlFor="household-search" className="flex items-center gap-2 text-base font-medium">
              <Search className="h-4 w-4" aria-hidden="true" /> Rechercher une famille
            </label>
          </h2>
          <Input
            id="household-search"
            placeholder="Nom, e-mail ou téléphone"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoComplete="off"
          />
        </CardHeader>
        <CardContent>
          {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
          {loading || actorLoading ? (
            <p role="status" className="flex items-center gap-2 text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : items.length === 0 && !failure ? (
            <p role="status" className="text-neutral-400">
              {query ? `Aucune famille ne correspond à « ${query} ».` : 'Aucune famille enregistrée pour le moment.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parents</TableHead>
                    <TableHead>Élèves</TableHead>
                    <TableHead className="sr-only">Ouvrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((household) => {
                    const primaryContact = household.parents.find((p) => p.isPrimaryContact) ?? household.parents[0];
                    const ficheLabel = primaryContact
                      ? `Ouvrir la fiche de ${displayName(primaryContact)}`
                      : `Ouvrir la fiche du foyer ${household.id}`;
                    return (
                      <TableRow key={household.id}>
                        <TableCell>
                          <ul className="space-y-1.5">
                            {household.parents.map((parent) => (
                              <li key={parent.id} className="text-neutral-100">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span>{displayName(parent)}</span>
                                  {parent.isPrimaryContact && <span className="text-xs text-brand-accent">contact principal</span>}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <AccountStatusBadge user={parent} organizationTimezone={organizationTimezone} />
                                  {parent.email && <span className="text-xs text-neutral-400">{parent.email}</span>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell>
                          {household.students.length === 0 ? (
                            <span className="text-neutral-400">Aucun élève</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {household.students.map((student) => (
                                <li key={student.id} className="text-neutral-100">
                                  <div>{displayName(student.user)}</div>
                                  <div className="mt-0.5">
                                    <AccountStatusBadge user={student.user} organizationTimezone={organizationTimezone} />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${basePath}/${household.id}`} aria-label={ficheLabel}>Ouvrir la fiche</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {nextCursor && (
                <div className="mt-4 flex justify-center">
                  <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void load(nextCursor)}>
                    {loadingMore ? 'Chargement…' : 'Afficher plus'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateHouseholdDialog({ basePath, onCreated }: { basePath: string; onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReport | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDuplicates(null);
    setAcknowledged(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      if (!duplicates) {
        const params = new URLSearchParams();
        if (form.email.trim()) params.set('email', form.email.trim());
        if (form.phone.trim()) params.set('phone', form.phone.trim());
        if (form.firstName.trim() && form.lastName.trim()) {
          params.set('firstName', form.firstName.trim());
          params.set('lastName', form.lastName.trim());
        }
        const check = await v2<DuplicateReport>(`/staff/duplicates?${params.toString()}`);
        if (!check.ok) {
          setFailure(check);
          return;
        }
        setDuplicates(check.data);
        if (check.data.hardConflict || (check.data.possibleMatches.length > 0 && !acknowledged)) return;
      } else if (duplicates.hardConflict || (duplicates.possibleMatches.length > 0 && !acknowledged)) {
        return;
      }
      const created = await v2<{ household: { id: string } }>('/staff/households', {
        method: 'POST',
        json: { parent: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone || undefined } },
      });
      if (!created.ok) {
        setFailure(created);
        return;
      }
      setOpen(false);
      onCreated();
      router.push(`${basePath}/${created.data.household.id}`);
    } finally {
      setPending(false);
    }
  }

  const blockedByConflict = Boolean(duplicates?.hardConflict);
  const needsAcknowledgement = Boolean(duplicates && duplicates.possibleMatches.length > 0 && !acknowledged);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="w-full sm:w-auto">Nouvelle famille</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une famille</DialogTitle>
          <DialogDescription>Le premier parent devient le contact principal. Les doublons sont vérifiés avant la création.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-parent-first-name">Prénom</Label>
              <Input id="new-parent-first-name" required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-parent-last-name">Nom</Label>
              <Input id="new-parent-last-name" required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="new-parent-email">E-mail</Label>
            <Input id="new-parent-email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-parent-phone">Téléphone (optionnel)</Label>
            <Input id="new-parent-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>

          {duplicates?.hardConflict && (
            <StatusMessage kind="error">
              Un compte existe déjà avec cet e-mail ({displayName(duplicates.hardConflict)}).{' '}
              {duplicates.hardConflict.householdId ? (
                <Link className="underline" href={`${basePath}/${duplicates.hardConflict.householdId}`}>
                  Ouvrir sa fiche
                </Link>
              ) : (
                'Il n’appartient à aucun foyer.'
              )}
            </StatusMessage>
          )}
          {duplicates && !duplicates.hardConflict && duplicates.possibleMatches.length > 0 && (
            <div className="space-y-2">
              <StatusMessage kind="info">
                Personnes proches déjà enregistrées ({duplicates.possibleMatches.length}) — vérifiez avant de créer un doublon :
              </StatusMessage>
              <ul className="list-disc pl-5 text-sm text-neutral-200">
                {duplicates.possibleMatches.map((match) => (
                  <li key={match.id}>
                    {displayName(match)} — {match.reason === 'PHONE' ? 'même téléphone' : 'même nom'}
                    {match.householdId && (
                      <>
                        {' '}
                        <Link className="underline" href={`${basePath}/${match.householdId}`}>
                          voir le foyer
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {!acknowledged && (
                <Button type="button" variant="outline" onClick={() => setAcknowledged(true)}>
                  Ce n’est pas la même personne — créer quand même
                </Button>
              )}
            </div>
          )}
          {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || blockedByConflict || needsAcknowledgement}>
              {pending ? 'Vérification…' : duplicates ? 'Créer la famille' : 'Vérifier et créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
