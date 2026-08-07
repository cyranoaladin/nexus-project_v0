'use client';

import { useEffect, useRef, useState } from 'react';
import { FileAudio, FileCheck2, FileUp, Loader2, Mic, Square, Trash2 } from 'lucide-react';
import type { DiagnosticQuestion } from '@/lib/diagnostics/candidat-libre/types';

interface DocumentItem { id: string; category: string; originalName: string; sizeBytes: number; status: string; }

export function UploadPanel({ diagnosticId, question, disabled, onUploaded }: { diagnosticId: string; question: DiagnosticQuestion; disabled?: boolean; onUploaded: () => void }) {
  const rule = question.uploadRule!;
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setDocuments((data.documents ?? []).filter((item: DocumentItem) => item.category === rule.category));
  }
  useEffect(() => { void refresh(); }, [diagnosticId, rule.category]);

  async function upload(file: File) {
    setError(null);
    if (!rule.accept.includes(file.type)) { setError('Format de fichier non autorisé.'); return; }
    if (file.size > rule.maxBytesPerFile) { setError(`Fichier trop volumineux. Limite : ${Math.round(rule.maxBytesPerFile / 1024 / 1024)} Mo.`); return; }
    setUploading(true);
    const form = new FormData();
    form.set('file', file);
    form.set('category', rule.category);
    form.set('title', question.prompt);
    form.set('clientMutationId', crypto.randomUUID());
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents`, { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok) { setError(data.error ?? 'Échec du dépôt.'); return; }
    await refresh();
    onUploaded();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents/${id}`, { method: 'DELETE' });
    if (response.ok) await refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5">
      <div className="flex items-start gap-3"><FileUp className="mt-0.5 h-5 w-5 text-cyan-300" /><div><p className="text-sm font-semibold text-white">Déposer le document</p><p className="mt-1 text-xs leading-5 text-slate-400">{rule.help} Formats : PDF, JPEG, PNG ou WebP. Limite : {Math.round(rule.maxBytesPerFile/1024/1024)} Mo.</p></div></div>
      <input ref={inputRef} type="file" className="hidden" accept={rule.accept.join(',')} disabled={disabled || uploading || documents.length >= rule.maxFiles} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value=''; }} />
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={disabled || uploading || documents.length >= rule.maxFiles} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Choisir un fichier</button>
        {rule.category === 'ORAL_RECORDING' && <AudioRecorder disabled={disabled || uploading || documents.length >= rule.maxFiles} onRecorded={(file) => void upload(file)} />}
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="space-y-2">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="flex min-w-0 items-center gap-3"><FileCheck2 className="h-5 w-5 shrink-0 text-emerald-300" /><div className="min-w-0"><p className="truncate text-sm text-white">{document.originalName}</p><p className="text-xs text-slate-500">{(document.sizeBytes/1024/1024).toFixed(2)} Mo · {document.status}</p></div></div><button type="button" disabled={disabled} onClick={() => void remove(document.id)} aria-label="Supprimer le document" className="rounded-lg p-2 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
    </div>
  );
}

function AudioRecorder({ disabled, onRecorded }: { disabled?: boolean; onRecorded: (file: File) => void }) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
      onRecorded(new File([blob], `grand-oral-${Date.now()}.webm`, { type: blob.type }));
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
  }
  function stop() { recorder.current?.stop(); setRecording(false); }
  return <button type="button" disabled={disabled} onClick={() => recording ? stop() : void start()} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/50 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50">{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{recording ? 'Arrêter et déposer' : 'Enregistrer l’oral'}</button>;
}
