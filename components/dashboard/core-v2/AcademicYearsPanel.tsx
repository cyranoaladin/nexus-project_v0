'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type AcademicYear, type ApiFail, type ApiResult, describeFailure, v2 } from './api';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

const STATUS_LABEL: Record<AcademicYear['status'], string> = { UPCOMING: 'À venir', CURRENT: 'En cours', CLOSED: 'Clôturée' };

export function AcademicYearsPanel() {
  const { can } = useStaffActor();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [form, setForm] = useState({ startYear: '', startsAt: '', endsAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const result = await v2<AcademicYear[]>('/staff/academic-years');
    if (result.ok) setYears(result.data);
    else setFailure(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(key: string, run: () => Promise<ApiResult<unknown>>, doneMessage: string) {
    if (pending) return;
    setPending(key);
    setFailure(null);
    setSuccess(null);
    const result = await run();
    if (result.ok) {
      setSuccess(doneMessage);
      await load();
    } else {
      setFailure(result);
    }
    setPending(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Années scolaires</h1>
        <p className="text-sm text-neutral-400">Une seule année « en cours » à la fois ; les dates sont saisies, jamais présumées.</p>
      </header>
      {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
      {success && <StatusMessage kind="success">{success}</StatusMessage>}

      {can('ENROLLMENT_CREATE') && (
        <Card className="border-white/10 bg-surface-dark">
          <CardHeader>
            <CardTitle className="text-white">Créer une année</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void act(
                  'create',
                  () =>
                    v2('/staff/academic-years', {
                      method: 'POST',
                      json: { startYear: Number(form.startYear), startsAt: form.startsAt, endsAt: form.endsAt },
                    }),
                  `Année ${form.startYear}-${Number(form.startYear) + 1} créée.`,
                );
              }}
            >
              <div>
                <Label htmlFor="year-start">Année de début</Label>
                <Input id="year-start" inputMode="numeric" required value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="year-starts-at">Début</Label>
                <Input id="year-starts-at" type="date" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="year-ends-at">Fin</Label>
                <Input id="year-ends-at" type="date" required value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending === 'create'}>
                  {pending === 'create' ? 'Création…' : 'Créer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-surface-dark">
        <CardContent className="pt-6">
          {loading ? (
            <p role="status" className="text-neutral-300">Chargement…</p>
          ) : years.length === 0 ? (
            <p role="status" className="text-neutral-400">Aucune année scolaire définie.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Année</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="text-neutral-100">
                      {year.startYear}-{year.startYear + 1}
                    </TableCell>
                    <TableCell className="text-neutral-300">
                      {year.startsAt.slice(0, 10)} → {year.endsAt.slice(0, 10)}
                    </TableCell>
                    <TableCell>{STATUS_LABEL[year.status]}</TableCell>
                    <TableCell className="space-x-2">
                      {can('ENROLLMENT_CREATE') && year.status === 'UPCOMING' && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending === `current:${year.id}`}
                          onClick={() => void act(`current:${year.id}`, () => v2(`/staff/academic-years/${year.id}/current`, { method: 'POST' }), `${year.startYear}-${year.startYear + 1} est maintenant l’année en cours.`)}
                        >
                          Passer en cours
                        </Button>
                      )}
                      {can('ENROLLMENT_CREATE') && year.status === 'CURRENT' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending === `close:${year.id}`}
                          onClick={() => void act(`close:${year.id}`, () => v2(`/staff/academic-years/${year.id}/close`, { method: 'POST' }), `${year.startYear}-${year.startYear + 1} clôturée.`)}
                        >
                          Clôturer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
