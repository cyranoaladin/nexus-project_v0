'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function AdminCashReservations() {
  const { data, mutate } = useSWR('/api/payments/cash/pending', fetcher);

  const confirm = async (id: number) => {
    await fetch('/api/payments/cash/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: id }) });
    mutate();
  };
  const cancel = async (id: number) => {
    await fetch('/api/payments/cash/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: id }) });
    mutate();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Réservations Cash — En attente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data || []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between bg-muted/20 p-3 rounded-xl">
              <div className="text-sm">#{r.id} • user={r.userId} • pack={r.packId} • {r.amountTnd} TND • {new Date(r.createdAt).toLocaleString()}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => confirm(r.id)}>Valider</Button>
                <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>Annuler</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="text-sm text-muted-foreground">Aucune réservation en attente.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
