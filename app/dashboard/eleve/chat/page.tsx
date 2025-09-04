"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";

export default function AriaChatPage() {
  const [studentId, setStudentId] = useState<string>("");
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [typing, setTyping] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; }>>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to infer student id from localStorage or query in the future
    const sid = localStorage.getItem("aria_student_id") || "seed-student";
    setStudentId(sid);
    // Auto-suggestion subject/level from profile
    fetch(`/api/student/profile?studentId=${encodeURIComponent(sid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (!p) return;
        if (!level && p?.level) setLevel(p.level);
        if (!subject && Array.isArray(p?.subjects) && p.subjects.length) setSubject(String(p.subjects[0]));
      }).catch(() => {});
  }, []);

  // Load saved conversation
  useEffect(() => {
    if (!studentId) return;
    try {
      const raw = localStorage.getItem(`aria_chat_${studentId}`);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [studentId]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages.length]);

  const persist = (list: Array<{ role: 'user' | 'assistant'; content: string; }>) => {
    try { localStorage.setItem(`aria_chat_${studentId}`, JSON.stringify(list)); } catch {}
  };

  async function send() {
    const text = input.trim();
    if (!text || !studentId) return;
    setMessages((m): Array<{ role: 'user' | 'assistant'; content: string; }> => {
      const next: Array<{ role: 'user' | 'assistant'; content: string; }> = [...m, { role: 'user', content: text }];
      persist(next);
      return next;
    });
    setInput("");
    setTyping(true);
    try {
      const res = await fetch('/api/aria/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, message: text, subject, level }) });
      const j = await res.json();
      setMessages((m): Array<{ role: 'user' | 'assistant'; content: string; }> => {
        const next: Array<{ role: 'user' | 'assistant'; content: string; }> = [...m, { role: 'assistant', content: j.reply || '…' }];
        persist(next);
        return next;
      });
    } catch (e: any) {
      setMessages((m): Array<{ role: 'user' | 'assistant'; content: string; }> => {
        const next: Array<{ role: 'user' | 'assistant'; content: string; }> = [...m, { role: 'assistant', content: 'Erreur côté serveur.' }];
        persist(next);
        return next;
      });
    }
    setTyping(false);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">ARIA — Chat</h1>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-600">Matière</label>
          <select className="border rounded px-2 py-1" value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">Auto</option>
            <option value="NSI">NSI</option>
            <option value="MATHS">Mathématiques</option>
            <option value="PHYSIQUE">Physique</option>
            <option value="FRANCAIS">Français</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600">Niveau</label>
          <select className="border rounded px-2 py-1" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">Auto</option>
            <option value="premiere">Première</option>
            <option value="terminale">Terminale</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-500">ID: {studentId || '—'}</div>
      </div>
      <div ref={boxRef} className="border rounded-md h-[60vh] overflow-y-auto p-3 space-y-3 bg-white">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block px-3 py-2 rounded-md ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content}</div>
          </div>
        ))}
        {typing && (
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-slate-800">
              <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="inline-block w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
          </div>
        )}
        {!messages.length && <div className="text-slate-500">Démarrez la conversation avec ARIA…</div>}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Posez votre question…" onKeyDown={e => e.key === 'Enter' && send()} />
        <Button onClick={send} disabled={typing}>Envoyer</Button>
        <Button variant="outline" onClick={() => { setMessages([]); try { localStorage.removeItem(`aria_chat_${studentId}`); } catch {} }}>Effacer</Button>
      </div>
    </div>
  );
}
