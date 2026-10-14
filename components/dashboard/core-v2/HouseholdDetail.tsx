'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AcademicYear, type ApiFail, type CoachSummary, type HouseholdDetail as HouseholdDetailModel, type Page, type PublicUser, describeFailure, displayName, v2 } from './api';
import { AccountActions } from './AccountActions';
import { HouseholdMembershipActions } from './HouseholdMembershipActions';
import { useAction } from './actions';
import { StatusMessage } from './StatusMessage';
import { StudentsSection } from './StudentsSection';
import { useStaffActor } from './useStaffActor';

export function HouseholdDetail({ householdId, basePath }: { householdId: string; basePath: string }) {
  const { can, loading: actorLoading } = useStaffActor();
  const [household, setHousehold] = useState<HouseholdDetailModel | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [coaches, setCoaches] = useState<CoachSummary[]>([]);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await v2<HouseholdDetailModel>(`/staff/households/${householdId}`);
    if (result.ok) {
      setHousehold(result.data);
      setFailure(null);
    } else {
      setFailure(result);
    }
  }, [householdId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [detail, yearList, coachList] = await Promise.all([
        v2<HouseholdDetailModel>(`/staff/households/${householdId}`),
        v2<AcademicYear[]>('/staff/academic-years'),
        v2<Page<CoachSummary>>('/staff/coaches?limit=100'),
      ]);
      if (cancelled) return;
      if (detail.ok) setHousehold(detail.data);
      else setFailure(detail);
      if (yearList.ok) setYears(yearList.data);
      if (coachList.ok) setCoaches(coachList.data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  if (loading || actorLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement de la fiche…
      </p>
    );
  }
  if (!household) {
    return (
      <div className="space-y-4">
        <StatusMessage kind="error">{failure ? describeFailure(failure) : 'Foyer introuvable.'}</StatusMessage>
        <Button asChild variant="outline">
          <Link href={basePath}>Retour aux familles</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="core-v2 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Foyer {household.parents.map(displayName).join(' & ') || household.id}</h1>
          <p className="text-sm text-neutral-400">Créé le {household.createdAt.slice(0, 10)}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={basePath}>Retour aux familles</Link>
        </Button>
      </header>
      {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}

      <ParentsSection household={household} can={can} refresh={refresh} />
      <StudentsSection household={household} years={years} coaches={coaches} can={can} refresh={refresh} />
      {can('INVITATION_SCOPE_MANAGE') && <InvitationAssignments householdId={household.id} />}
    </div>
  );
}

type InvitationAssignmentsModel = {
  householdId: string;
  assistants: Array<{ id: string; firstName: string | null; lastName: string | null; accountStatus: string }>;
  years: Array<{ id: string; startYear: number; status: string }>;
  grants: Array<{ staffUserId: string; academicYearId: string; revision: number; revokedAt: string | null }>;
};
function isInvitationAssignments(value: unknown, householdId: string): value is InvitationAssignmentsModel {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object';
  const id = (item: unknown) => typeof item === 'string' && item.length > 0;
  const nullableString = (item: unknown) => item === null || typeof item === 'string';
  return data.householdId === householdId
    && Array.isArray(data.assistants) && data.assistants.every(a => record(a) && id(a.id)
      && nullableString(a.firstName) && nullableString(a.lastName)
      && ['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED', 'DISABLED'].includes(String(a.accountStatus)))
    && Array.isArray(data.years) && data.years.every(y => record(y) && id(y.id)
      && Number.isSafeInteger(y.startYear) && ['CURRENT', 'UPCOMING', 'CLOSED'].includes(String(y.status)))
    && Array.isArray(data.grants) && data.grants.every(g => record(g) && id(g.staffUserId)
      && id(g.academicYearId) && typeof g.revision === 'number' && Number.isSafeInteger(g.revision)
      && g.revision >= 0 && nullableString(g.revokedAt));
}
function InvitationAssignments({ householdId }: { householdId: string }) {
  const [data, setData] = useState<InvitationAssignmentsModel | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const [staffUserId, setStaffUserId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    const result = await v2<unknown>(`/staff/households/${householdId}/invitation-scopes`);
    if (version !== requestVersion.current) return;
    if (result.ok && isInvitationAssignments(result.data, householdId)) {
      setData(result.data); setFailure(null);
    } else {
      setData(null);
      setFailure(result.ok ? { ok: false, status: 502, code: 'INVALID_RESPONSE', message: 'Réponse des affectations invalide.' } : result);
    }
    setLoading(false);
  }, [householdId]);
  useEffect(() => { void refresh(); return () => { requestVersion.current += 1; }; }, [refresh]);
  const action = useAction(refresh, refresh);
  const selected = data?.grants.find(g => g.staffUserId === staffUserId && g.academicYearId === academicYearId);
  const change = (staffId: string, yearId: string, revision: number, active: boolean) => action.run(
    `${staffId}:${yearId}`, () => v2(`/staff/households/${householdId}/invitation-scopes`, {
      method: 'PUT', json: { staffUserId: staffId, academicYearId: yearId, expectedRevision: revision, active },
    }), active ? 'Affectation enregistrée.' : 'Affectation retirée.');
  return <Card className="border-white/10 bg-surface-dark">
    <CardHeader><h2 className="text-base font-semibold text-white">Affectations des assistantes</h2>
      <p className="text-sm text-neutral-400">Autorisez une assistante à préparer les inscriptions et inviter les familles de ce foyer pour une année précise. Le retrait annule aussi les invitations encore en attente de remise.</p></CardHeader>
    <CardContent className="space-y-4">
      {(failure || action.failure) && <StatusMessage kind="error">{describeFailure((failure || action.failure)!)}</StatusMessage>}
      {action.success && <StatusMessage kind="success">{action.success}</StatusMessage>}
      {loading ? <p role="status">Chargement des affectations…</p> : data && <>
        <ul className="space-y-2">{data.grants.filter(g => !g.revokedAt).map(g => <li key={`${g.staffUserId}:${g.academicYearId}`} className="flex flex-wrap items-center justify-between gap-2">
          <span>{displayName(data.assistants.find(a => a.id === g.staffUserId) || { firstName: null, lastName: null })} · {data.years.find(y => y.id === g.academicYearId)?.startYear}–{(data.years.find(y => y.id === g.academicYearId)?.startYear ?? 0) + 1}
            {(data.years.find(y => y.id === g.academicYearId)?.status === 'CLOSED' || data.assistants.find(a => a.id === g.staffUserId)?.accountStatus !== 'ACTIVE') && <span className="ml-2 text-sm text-neutral-400">Affectation inactive</span>}</span>
          <Button size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void change(g.staffUserId, g.academicYearId, g.revision, false)}>Retirer l’affectation</Button>
        </li>)}</ul>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void change(staffUserId, academicYearId, selected?.revision ?? 0, true); }}>
          <div><Label htmlFor="invitation-assistant">Assistante</Label><select id="invitation-assistant" required value={staffUserId} onChange={e => setStaffUserId(e.target.value)} className="block rounded border border-white/20 bg-surface-dark p-2 text-white">
            <option value="">Choisir une assistante</option>{data.assistants.filter(a => a.accountStatus === 'ACTIVE').map(a => <option key={a.id} value={a.id}>{displayName(a)}</option>)}
          </select></div>
          <div><Label htmlFor="invitation-year">Année scolaire</Label><select id="invitation-year" required value={academicYearId} onChange={e => setAcademicYearId(e.target.value)} className="block rounded border border-white/20 bg-surface-dark p-2 text-white">
            <option value="">Choisir une année</option>{data.years.filter(y => y.status !== 'CLOSED').map(y => <option key={y.id} value={y.id}>{y.startYear}–{y.startYear + 1}</option>)}
          </select></div>
          <Button type="submit" disabled={!staffUserId || !academicYearId || action.pending !== null || !!selected && !selected.revokedAt}>Affecter</Button>
        </form>
      </>}
      <Button variant="outline" size="sm" disabled={loading || action.pending !== null} onClick={() => void refresh()}>Actualiser les affectations</Button>
    </CardContent>
  </Card>;
}

function ParentsSection({ household, can, refresh }: { household: HouseholdDetailModel; can: (c: string) => boolean; refresh: () => Promise<void> }) {
  const action = useAction(refresh);
  return (
    <Card className="border-white/10 bg-surface-dark">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Parents</h2>
        {(can('PARENT_CREATE') || can('PARENT_ATTACH')) && <AddParentDialog householdId={household.id} can={can} onDone={refresh} />}
      </CardHeader>
      <CardContent className="space-y-4">
        {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
        {action.success && <StatusMessage kind="success">{action.success}</StatusMessage>}
        {household.parents.map((parent) => (
          <div key={parent.id} className="rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">
                  {displayName(parent)}
                  {parent.isPrimaryContact && <span className="ml-2 text-xs text-brand-accent">contact principal</span>}
                </p>
                <p className="text-sm text-neutral-400">{parent.email ?? '—'} · {parent.phone ?? '—'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {can('HOUSEHOLD_EDIT') && parent.verificationStatus === 'VERIFIED' && !parent.isPrimaryContact && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={action.pending !== null}
                    onClick={() =>
                      void action.run(`primary:${parent.id}`, () => v2(`/staff/households/${household.id}/primary-contact`, { method: 'PUT', json: { parentUserId: parent.id } }), `${displayName(parent)} est maintenant le contact principal.`)
                    }
                  >
                    Définir contact principal
                  </Button>
                )}
                {can('HOUSEHOLD_EDIT') && <CorrectParentDialog parent={parent} onDone={refresh} />}
                {can('HOUSEHOLD_EDIT') && <HouseholdMembershipActions householdId={household.id} parent={parent} onChanged={refresh} />}
              </div>
            </div>
            <div className="mt-3">
              <AccountActions user={parent} can={can} onChanged={refresh} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddParentDialog({ householdId, can, onDone }: { householdId: string; can: (c: string) => boolean; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>(can('PARENT_CREATE') ? 'new' : 'existing');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Array<PublicUser & { householdId: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });

  useEffect(() => {
    if (mode !== 'existing' || search.trim().length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const result = await v2<Page<PublicUser & { householdId: string | null }>>(`/staff/parents?q=${encodeURIComponent(search.trim())}&limit=10`);
      if (cancelled) return;
      setCandidates(result.ok ? result.data.items.filter((p) => !p.householdId) : []);
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">Ajouter un parent</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un parent au foyer</DialogTitle>
          <DialogDescription>Créez un nouveau compte parent ou rattachez un compte parent existant sans foyer.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Type d’ajout" className="flex gap-2">
          {can('PARENT_CREATE') && (
            <Button type="button" role="radio" aria-checked={mode === 'new'} variant={mode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setMode('new')}>
              Nouveau parent
            </Button>
          )}
          {can('PARENT_ATTACH') && can('STAFF_ACCOUNT_CREATE') && (
            <Button type="button" role="radio" aria-checked={mode === 'existing'} variant={mode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setMode('existing')}>
              Parent existant
            </Button>
          )}
        </div>
        {mode === 'new' ? (
          <form
            className="space-y-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void action.run('create-parent', () => v2(`/staff/households/${householdId}/parents`, { method: 'POST', json: { parent: { ...form, phone: form.phone || undefined } } }), 'Parent ajouté.');
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="add-parent-first-name">Prénom</Label>
                <Input id="add-parent-first-name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="add-parent-last-name">Nom</Label>
                <Input id="add-parent-last-name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="add-parent-email">E-mail</Label>
              <Input id="add-parent-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="add-parent-phone">Téléphone (optionnel)</Label>
              <Input id="add-parent-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
            <div className="flex justify-end">
              <Button type="submit" disabled={action.pending !== null}>{action.pending ? 'Ajout…' : 'Ajouter'}</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="attach-parent-search">Rechercher un parent sans foyer</Label>
              <Input id="attach-parent-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, e-mail ou téléphone" />
            </div>
            {searching && <p role="status" className="text-sm text-neutral-400">Recherche…</p>}
            {!searching && search.trim().length >= 2 && candidates.length === 0 && <p role="status" className="text-sm text-neutral-400">Aucun parent sans foyer ne correspond.</p>}
            <ul className="space-y-2">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="flex items-center justify-between gap-2 rounded border border-white/10 p-2">
                  <span className="text-sm text-neutral-100">{displayName(candidate)} <span className="text-neutral-400">{candidate.email}</span></span>
                  <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run(`attach:${candidate.id}`, () => v2(`/staff/households/${householdId}/parents`, { method: 'POST', json: { existingParentUserId: candidate.id } }), 'Parent rattaché.')}>
                    Rattacher
                  </Button>
                </li>
              ))}
            </ul>
            {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CorrectParentDialog({ parent, onDone }: { parent: PublicUser; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: parent.firstName ?? '', lastName: parent.lastName ?? '', email: parent.email ?? '', phone: parent.phone ?? '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">Corriger</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger les coordonnées de {displayName(parent)}</DialogTitle>
          <DialogDescription>Un changement d’e-mail ou de téléphone révoque les sessions ouvertes. La correction est journalisée.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const changes: Record<string, string | null> = {};
            if (form.firstName !== (parent.firstName ?? '')) changes.firstName = form.firstName;
            if (form.lastName !== (parent.lastName ?? '')) changes.lastName = form.lastName;
            if (form.email !== (parent.email ?? '')) changes.email = form.email;
            if (form.phone !== (parent.phone ?? '')) changes.phone = form.phone || null;
            void action.run('correct', () => v2(`/staff/parents/${parent.id}`, { method: 'PATCH', json: changes }), 'Coordonnées corrigées.');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`fix-first-${parent.id}`}>Prénom</Label>
              <Input id={`fix-first-${parent.id}`} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`fix-last-${parent.id}`}>Nom</Label>
              <Input id={`fix-last-${parent.id}`} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={`fix-email-${parent.id}`}>E-mail</Label>
            <Input id={`fix-email-${parent.id}`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={`fix-phone-${parent.id}`}>Téléphone</Label>
            <Input id={`fix-phone-${parent.id}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
