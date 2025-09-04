'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function CashReservationPage() {
  const [userId, setUserId] = useState('');
  const [packId, setPackId] = useState('');
  const [amountTnd, setAmountTnd] = useState('');
  const [msg, setMsg] = useState<string | undefined>();
  const [recordId, setRecordId] = useState<number | undefined>();

  const reserve = async () => {
    setMsg(undefined);
    const r = await fetch('/api/payments/cash/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, packId: Number(packId), amountTnd: Number(amountTnd) }) });
    const js = await r.json();
    if (!r.ok) { setMsg(js?.error || 'Erreur'); return; }
    setRecordId(js.recordId);
    setMsg(js.message || 'Réservation créée — validation après paiement au centre.');
  };

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Paiement au centre (Cash)</CardTitle>
          <CardDescription>Réservez votre règlement en espèces. Un administrateur validera après paiement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Utilisateur (userId)</Label>
            <Input value={userId} onChange={e => setUserId(e.target.value)} placeholder="id utilisateur" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pack Id</Label>
              <Input value={packId} onChange={e => setPackId(e.target.value)} type="number" />
            </div>
            <div>
              <Label>Montant (TND)</Label>
              <Input value={amountTnd} onChange={e => setAmountTnd(e.target.value)} type="number" step="0.01" />
            </div>
          </div>
          <Button onClick={reserve}>Réserver et payer au centre</Button>
          {msg && <p className="text-sm text-muted-foreground">{msg}{recordId ? ` (Référence ${recordId})` : ''}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
