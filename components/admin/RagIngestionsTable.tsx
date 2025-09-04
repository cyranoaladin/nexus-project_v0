'use client';

import { useEffect, useState } from 'react';

export default function RagIngestionsTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/admin/rag/ingestions', { credentials: 'include' });
      const js = await r.json();
      if (!r.ok) throw new Error(js?.error || 'Erreur');
      setRows(js.items || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p>Chargement des ingestions…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Ingestions RAG récentes</h3>
      <div className="text-sm text-muted-foreground">Dernières 50 opérations</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Acteur</th>
              <th className="p-2">DocId</th>
              <th className="p-2">Sujet/Niveau</th>
              <th className="p-2">Chunks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{new Date(r.at).toLocaleString()}</td>
                <td className="p-2">{r.actor}</td>
                <td className="p-2">{r.diff?.docId || '—'}</td>
                <td className="p-2">{r.diff?.subject || '—'} / {r.diff?.level || '—'}</td>
                <td className="p-2">{r.diff?.chunks ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
