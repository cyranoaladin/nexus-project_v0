'use client';

import { useProtectedFetch, useSessionMutationSuspended, useSessionRecoveryController } from '@/components/auth/SessionRecoveryProvider';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCheck2, FileUp, Loader2, Mic, Square, Trash2 } from 'lucide-react';
import type { DiagnosticQuestion } from '@/lib/diagnostics/candidat-libre/types';

interface DocumentItem { id: string; category: string; originalName: string; sizeBytes: number; status: string; }

export function UploadPanel({ diagnosticId, question, disabled, onUploaded }: { diagnosticId: string; question: DiagnosticQuestion; disabled?: boolean; onUploaded: () => void }) {
  const fetch = useProtectedFetch();
  const controller = useSessionRecoveryController();
  const rule = question.uploadRule!;
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutationIds = useRef(new WeakMap<File, string>());

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents`, { cache: 'no-store' });
    if (!response.ok) throw new Error('DOCUMENT_LIST_UNAVAILABLE');
    const data = await response.json();
    setDocuments((data.documents ?? []).filter((item: DocumentItem) => item.category === rule.category));
  }, [diagnosticId, rule.category, fetch]);
  useEffect(() => { void refresh().catch(() => setError('Documents momentanément indisponibles.')); }, [refresh]);

  async function upload(file: File) {
    setError(null);
    if (!rule.accept.includes(file.type)) { setError('Format de fichier non autorisé.'); return false; }
    if (file.size > rule.maxBytesPerFile) { setError(`Fichier trop volumineux. Limite : ${Math.round(rule.maxBytesPerFile / 1024 / 1024)} Mo.`); return false; }
    setUploading(true);
    let deposited = false;
    try {
    const check = controller.captureMutation();
    const form = new FormData();
    form.set('file', file);
    form.set('category', rule.category);
    form.set('title', question.prompt);
    if (!mutationIds.current.has(file)) mutationIds.current.set(file, crypto.randomUUID());
    form.set('clientMutationId', mutationIds.current.get(file)!);
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents`, { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? 'Échec du dépôt.'); return false; }
    deposited = true;
    await refresh();
    check();
    onUploaded();
    return true;
    } catch {
      setError(deposited ? 'Dépôt confirmé, mais liste momentanément indisponible. Ne déposez pas à nouveau ce fichier.' : 'Le dépôt n’est pas confirmé. Vérifiez votre connexion et votre session.');
      return deposited;
    } finally { setUploading(false); }
  }

  async function remove(id: string) {
    setError(null);
    try {
    const response = await fetch(`/api/diagnostics/candidat-libre/${diagnosticId}/documents/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('DELETE_NOT_CONFIRMED');
    await refresh();
    } catch { setError('La suppression ou son actualisation n’est pas confirmée. Vérifiez votre connexion et votre session.'); }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-5">
      <div className="flex items-start gap-3"><FileUp className="mt-0.5 h-5 w-5 text-cyan-300" /><div><p className="text-sm font-semibold text-white">Déposer le document</p><p className="mt-1 text-xs leading-5 text-slate-400">{rule.help} Formats : PDF, JPEG, PNG ou WebP. Limite : {Math.round(rule.maxBytesPerFile/1024/1024)} Mo.</p></div></div>
      <input ref={inputRef} type="file" className="hidden" accept={rule.accept.join(',')} disabled={disabled || uploading || documents.length >= rule.maxFiles} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value=''; }} />
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={disabled || uploading || documents.length >= rule.maxFiles} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Choisir un fichier</button>
        {rule.category === 'ORAL_RECORDING' && <AudioRecorder disabled={disabled || uploading || documents.length >= rule.maxFiles} onRecorded={upload} onError={() => setError('L’enregistrement audio ne peut pas être déposé actuellement. Vérifiez votre session et l’autorisation du microphone.')} />}
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="space-y-2">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="flex min-w-0 items-center gap-3"><FileCheck2 className="h-5 w-5 shrink-0 text-emerald-300" /><div className="min-w-0"><p className="truncate text-sm text-white">{document.originalName}</p><p className="text-xs text-slate-500">{(document.sizeBytes/1024/1024).toFixed(2)} Mo · {document.status}</p></div></div><button type="button" disabled={disabled} onClick={() => void remove(document.id)} aria-label="Supprimer le document" className="rounded-lg p-2 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
    </div>
  );
}

function AudioRecorder({ disabled, onRecorded, onError }: { disabled?: boolean; onRecorded: (file: File) => Promise<boolean>; onError: () => void }) {
  const controller = useSessionRecoveryController();
  const suspended = useSessionMutationSuspended();
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retainedFile, setRetainedFile] = useState<File | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const active = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  async function start() {
    setStarting(true);
    let stream: MediaStream | undefined;
    try {
    const check = controller.captureMutation();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!active.current) { stream.getTracks().forEach(track => track.stop()); return; }
    check();
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    mediaRecorder.onstop = () => {
      try {
      if (!active.current) return;
      const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
      const file = new File([blob], `grand-oral-${Date.now()}.webm`, { type: blob.type });
      setRetainedFile(file);
      check();
      void deposit(file);
      } catch { if (active.current) onError(); }
      finally { stream?.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    };
    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (active.current) onError();
    } finally { if (active.current) setStarting(false); }
  }
  function stop() { recorder.current?.stop(); setRecording(false); }
  async function deposit(file: File) {
    try {
      controller.captureMutation()();
      if (await onRecorded(file) && active.current) setRetainedFile(null);
    } catch { if (active.current) onError(); }
  }
  return <>
    {recording && suspended && createPortal(
      <button type="button" data-session-recovery-control="true" onClick={stop} className="fixed bottom-4 right-4 z-[100] rounded-xl bg-slate-950 px-4 py-3 text-white ring-2 ring-violet-300">Arrêter l’enregistrement et le conserver</button>, document.body,
    )}
    {!(recording && suspended) && <button type="button" disabled={disabled || starting || !!retainedFile} onClick={() => recording ? stop() : void start()} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/50 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-50">{recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{recording ? 'Arrêter et déposer' : 'Enregistrer l’oral'}</button>}
    {retainedFile && <button type="button" disabled={disabled || suspended} onClick={() => void deposit(retainedFile)} className="rounded-xl border border-violet-300 px-4 py-2 text-sm text-violet-100">Déposer l’enregistrement conservé</button>}
  </>;
}
