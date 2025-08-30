// components/bilan/MailLogClient.tsx
"use client";
import React, { useState } from 'react';
import { MailLogRow, MailLogTable } from './MailLogTable';

export function MailLogClient({ bilanId, rows: initialRows }: { bilanId: string; rows: MailLogRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function onResend(row: MailLogRow) {
    try {
      setLoadingId(row.id);
      const res = await fetch(`/api/bilan/email/${bilanId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: row.variant, toStudent: true, toParent: row.recipients.includes('@') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur d’envoi');
      setRows([{ ...row, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'SENT' }, ...rows]);
      alert('Mail renvoyé avec succès.');
    } catch (e: any) {
      alert(e?.message || 'Échec du renvoi');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <MailLogTable rows={rows} onResend={onResend} />
      {loadingId && <p className="text-sm text-slate-500 mt-2">Envoi en cours…</p>}
    </div>
  );
}

