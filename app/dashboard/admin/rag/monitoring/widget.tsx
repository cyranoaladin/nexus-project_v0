"use client";

import { useEffect, useState } from 'react';

type Job = { id: string; name?: string; data?: any; progress?: number; attemptsMade?: number; failedReason?: string; };

export default function MonitoringWidget() {
  const [stats, setStats] = useState<any>(null);
  const [active, setActive] = useState<Job[]>([]);
  const [waiting, setWaiting] = useState<Job[]>([]);
  const [failed, setFailed] = useState<Job[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/queue/ingest', { cache: 'no-store' });
        const j = await res.json();
        if (!stop) {
          setStats(j.stats); setActive(j.active || []); setWaiting(j.waiting || []); setFailed(j.failed || []);
        }
      } catch {}
    };
    load(); const id = setInterval(load, 3000); return () => { stop = true; clearInterval(id); };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">RAG — Monitoring des jobs</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <Panel title="Stats" content={stats ? JSON.stringify(stats) : '—'} />
        <Panel title="Actifs" content={JSON.stringify(active, null, 2)} />
        <Panel title="En attente" content={JSON.stringify(waiting, null, 2)} />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Échecs</h2>
        <pre className="bg-slate-50 border p-3 rounded text-xs overflow-x-auto">{JSON.stringify(failed, null, 2)}</pre>
      </div>
    </div>
  );
}

function Panel({ title, content }: { title: string; content: string; }) {
  return (
    <div className="bg-white border rounded p-3">
      <div className="text-sm font-semibold mb-1">{title}</div>
      <pre className="text-xs whitespace-pre-wrap break-words">{content}</pre>
    </div>
  );
}
