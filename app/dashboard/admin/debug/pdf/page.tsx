"use client";
import React from 'react';

export default function AdminPdfDebugPage() {
  const [variant, setVariant] = React.useState<'eleve' | 'parent'>('eleve');
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);

  async function startJob() {
    setStatus(null); setJobId(null);
    const res = await fetch(`/api/bilan/start?variant=${variant}`, { method: 'POST' });
    const js = await res.json();
    setJobId(js.id);
  }

  React.useEffect(() => {
    if (!jobId) return;
    setPolling(true);
    const t = setInterval(async () => {
      const r = await fetch(`/api/bilans/${jobId}/status`);
      const js = await r.json();
      setStatus(js.status || js.error);
      if (js.status === 'done' || js.error) {
        clearInterval(t); setPolling(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [jobId]);

  const downloadUrl = jobId ? `/api/bilans/${jobId}/download` : '#';

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin — Debug PDF</h1>
      <div style={{ marginTop: 12 }}>
        <label>Variant: </label>
        <select value={variant} onChange={e => setVariant(e.target.value as any)}>
          <option value="eleve">eleve</option>
          <option value="parent">parent</option>
        </select>
        <button onClick={startJob} style={{ marginLeft: 12 }}>Start</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div>JobId: {jobId || '-'}</div>
        <div>Status: {status || '-'}</div>
        {jobId && status === 'done' && (
          <a href={downloadUrl} target="_blank" rel="noreferrer">Download PDF</a>
        )}
        {polling && <div>Polling...</div>}
      </div>
    </div>
  );
}
