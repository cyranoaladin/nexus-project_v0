// components/bilan/MailLogTable.tsx
"use client";
import React from 'react';

export type MailLogRow = {
  id: string;
  createdAt: string; // ISO
  variant: string;
  recipients: string;
  status: string; // SENT | FAILED
  subject: string;
  messageId?: string;
};

export function MailLogTable({ rows, onResend }: { rows: MailLogRow[]; onResend: (row: MailLogRow) => void }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Variante</th>
            <th className="px-3 py-2 text-left">Destinataires</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString('fr-FR')}</td>
              <td className="px-3 py-2 capitalize">{r.variant}</td>
              <td className="px-3 py-2 truncate max-w-[320px]" title={r.recipients}>{r.recipients}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${r.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <button className="text-sky-700 hover:underline" onClick={() => onResend(r)}>Renvoyer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

