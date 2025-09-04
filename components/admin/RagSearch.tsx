"use client";

import { useState } from "react";

interface Hit {
  id: string;
  docId: string;
  subject?: string;
  level?: string;
  chunk: string;
  meta?: any;
}

export default function RagSearch() {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [k, setK] = useState<number>(8);
  const [hits, setHits] = useState<Hit[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL("/api/rag/search", window.location.origin);
      if (q) url.searchParams.set("q", q);
      if (subject) url.searchParams.set("subject", subject);
      if (level) url.searchParams.set("level", level);
      url.searchParams.set("k", String(k || 8));
      const r = await fetch(url.toString(), { cache: "no-store" });
      const js = await r.json();
      if (!r.ok) throw new Error(js?.error || "Erreur");
      setProvider(js.provider || "");
      setHits(js.hits || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const highlight = (text: string) => {
    if (!q) return text;
    try {
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = q.split(/\s+/).filter(Boolean).map(esc);
      if (!parts.length) return text;
      const re = new RegExp(`(${parts.join('|')})`, 'gi');
      return text.replace(re, '<mark>$1</mark>');
    } catch {
      return text;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium">Requête</label>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="ex: graphes orientés"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Matière</label>
          <input className="border rounded px-2 py-1 w-40" placeholder="NSI|MATH" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Niveau</label>
          <input className="border rounded px-2 py-1 w-40" placeholder="terminale|premiere" value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">k</label>
          <input type="number" className="border rounded px-2 py-1 w-20" value={k} onChange={(e) => setK(Number(e.target.value || 8))} />
        </div>
        <button disabled={loading || !q} onClick={run} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {loading ? "Recherche…" : "Rechercher"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!!provider && <div className="text-sm text-muted-foreground">Provider: {provider}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">DocId</th>
              <th className="p-2">Sujet/Niveau</th>
              <th className="p-2">Source</th>
              <th className="p-2">Extrait</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((h, i) => (
              <tr key={i} className="border-t align-top">
                <td className="p-2">{(h as any).docId || (h as any).doc_id || h.docId}</td>
                <td className="p-2">{h.subject || "—"} / {h.level || "—"}</td>
                <td className="p-2">
                  {(() => {
                    const dt = (h as any).meta?.docType || 'doc';
                    const label = dt.toUpperCase();
                    const cls = dt === 'pdf' ? 'bg-blue-100 text-blue-800' : dt === 'docx' ? 'bg-violet-100 text-violet-800' : dt === 'ocr' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800';
                    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
                  })()}
                </td>
                <td className="p-2"><pre className="whitespace-pre-wrap break-words text-xs" dangerouslySetInnerHTML={{ __html: highlight(h.chunk) }} /></td>
              </tr>
            ))}
            {hits.length === 0 && !loading && (
              <tr>
                <td className="p-2 text-muted-foreground" colSpan={3}>Aucun résultat</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

