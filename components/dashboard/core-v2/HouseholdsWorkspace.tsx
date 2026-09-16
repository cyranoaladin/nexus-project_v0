'use client';

import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type ApiFail, type DuplicateReport, type HouseholdSummary, type Page, type PublicUser, describeFailure, displayName, v2 } from './api';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

const ACCOUNT_LABEL: Record<PublicUser['accountStatus'], string> = {
  PENDING_ACTIVATION: 'À activer',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  DISABLED: 'Désactivé',
};

export function HouseholdsWorkspace({ basePath }: { basePath: string }) {
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Familles</h1>
          <p className="text-sm text-neutral-400">Référentiel Core v2 — foyers, parents, élèves, inscriptions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`${basePath}/annees`}>Années scolaires</Link>
          </Button>
          {can('HOUSEHOLD_CREATE') && <CreateHouseholdDialog basePath={basePath} onCreated={() => void load(null)} />}
        </div>
      </header>

      {actorFailure && <StatusMessage kind="error">{describeFailure(actorFailure)}</StatusMessage>}

      <Card className="border-white/10 bg-surface-dark">
        <CardHeader>
          <CardTitle className="text-white">
            <label htmlFor="household-search" className="flex items-center gap-2 text-base font-medium">
              <Search className="h-4 w-4" aria-hidden="true" /> Rechercher une famille
            </label>
          </CardTitle>
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
                    <TableHead>Comptes</TableHead>
                    <TableHead className="sr-only">Ouvrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((household) => (
                    <TableRow key={household.id}>
                      <TableCell>
                        <ul className="space-y-1">
                          {household.parents.map((parent) => (
                            <li key={parent.id} className="text-neutral-100">
                              {displayName(parent)}
                              {parent.isPrimaryContact && <span className="ml-2 text-xs text-brand-accent">contact principal</span>}
                              {parent.email && <span className="block text-xs text-neutral-400">{parent.email}</span>}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell>
                        {household.students.length === 0 ? (
                          <span className="text-neutral-500">Aucun élève</span>
                        ) : (
                          household.students.map((student) => <div key={student.id}>{displayName(student.user)}</div>)
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-neutral-300">
                        {[...household.parents, ...household.students.map((s) => s.user)].map((user) => (
                          <div key={user.id}>{ACCOUNT_LABEL[user.accountStatus]}</div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${basePath}/${household.id}`}>Ouvrir la fiche</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
        <Button type="button">Nouvelle famille</Button>
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
