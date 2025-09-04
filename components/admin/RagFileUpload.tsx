"use client";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function RagFileUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setMsg(null); setErr(null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files || []);
    setFiles(list);
    setMsg(null); setErr(null);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const onUpload = async () => {
    if (!files.length) return;
    setLoading(true); setMsg(null); setErr(null);
    try {
      const results: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/rag/upload', { method: 'POST', body: fd, credentials: 'include' });
        const js = await r.json();
        if (!r.ok) throw new Error(js?.error || `Erreur upload: ${file.name}`);
        results.push(js?.duplicate ? `dup:${js.docId}` : `ok:${js.docId}`);
      }
      setMsg(`Ingestion: ${results.join(', ')}`);
      setFiles([]);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <Label>Uploader des fichiers (pdf, docx, md, txt)</Label>
      <div className="border border-dashed rounded p-4 text-center text-sm text-slate-600" onDrop={onDrop} onDragOver={onDragOver}>
        Glissez-déposez ici plusieurs fichiers, ou utilisez le sélecteur ci-dessous.
      </div>
      <Input multiple type="file" onChange={onChange} accept=".pdf,.docx,.md,.txt" />
      {!!files.length && (
        <div className="text-xs text-slate-600">Sélection: {files.map(f => f.name).join(', ')}</div>
      )}
      <Button onClick={onUpload} disabled={!files.length || loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Importer
      </Button>
      {msg && (
        <Alert variant="default"><AlertTitle>Succès</AlertTitle><AlertDescription>{msg}</AlertDescription></Alert>
      )}
      {err && (
        <Alert variant="destructive"><AlertTitle>Erreur</AlertTitle><AlertDescription>{err}</AlertDescription></Alert>
      )}
    </div>
  );
}
