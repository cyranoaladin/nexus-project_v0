'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function PaymentsAdminTable() {
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('pending');
  const { data, mutate, isLoading } = useSWR(`/api/admin/payments/records?${provider ? `provider=${provider}&` : ''}${status ? `status=${status}&` : ''}limit=200`, fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paiements — Suivi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select onValueChange={setProvider}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">(Tous)</SelectItem>
              <SelectItem value="cash">cash</SelectItem>
              <SelectItem value="konnect">konnect</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">(Tous)</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="paid">paid</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => mutate()}>Rafraîchir</Button>
        </div>
        <div className="overflow-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Provider</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Pack</th>
                <th className="p-2 text-left">Montant</th>
                <th className="p-2 text-left">Créé</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.provider}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.userId}</td>
                  <td className="p-2">{r.packId}</td>
                  <td className="p-2">{r.amountTnd} TND</td>
                  <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!isLoading && !(data || []).length && (
                <tr><td className="p-3 text-muted-foreground" colSpan={7}>Aucun paiement trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
