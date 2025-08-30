// components/bilan/SendPdfByEmail.tsx
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SendPdfByEmail({ bilanId, defaultStudent=true, defaultParent=true }: { bilanId: string; defaultStudent?: boolean; defaultParent?: boolean; }) {
  const [variant, setVariant] = useState('standard');
  const [toStudent, setToStudent] = useState(defaultStudent);
  const [toParent, setToParent] = useState(defaultParent);
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSend() {
    try {
      setLoading(true); setStatus(null);
      const extraRecipients = extra.split(',').map(s=>s.trim()).filter(Boolean);
      const res = await fetch(`/api/bilan/email/${bilanId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, toStudent, toParent, extraRecipients })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec envoi');
      setStatus(`Envoyé: ${data.sentTo.join(', ')}`);
    } catch (e: any) {
      setStatus(e?.message || 'Erreur');
    } finally { setLoading(false); }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Variante PDF</label>
          <Select value={variant} onValueChange={setVariant}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Variante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="eleve">Élève</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Destinataires +</label>
          <Input className="mt-1" placeholder="ex: parent2@mail.com, conseiller@mail.com" value={extra} onChange={e=>setExtra(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 mt-6">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={toStudent} onCheckedChange={v=>setToStudent(Boolean(v))} /> Élève</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={toParent} onCheckedChange={v=>setToParent(Boolean(v))} /> Parent</label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onSend} disabled={loading}>{loading?'Envoi...':'Envoyer par e-mail'}</Button>
        {status && <span className="text-sm text-slate-600">{status}</span>}
      </div>
    </div>
  );
}

