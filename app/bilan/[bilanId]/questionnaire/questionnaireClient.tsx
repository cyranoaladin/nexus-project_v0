"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useMemo, useState } from 'react';

type QcmQuestion = { id: string; domain?: string; weight?: number; type?: string; statement: string; options?: string[]; };

export default function QuestionnaireClient({ bilanId, studentId, subject, grade, data }: { bilanId: string; studentId: string; subject: string; grade: string; data: any; }) {
  const requiresVolet2 = !!data?.requiresVolet2;
  const q1: QcmQuestion[] = data?.volet1?.questions || [];
  const v2: any[] = data?.volet2?.questions || [];

  const storageKey = useMemo(() => `bilan:${bilanId}:draft`, [bilanId]);
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, any>>({});
  const [pedagoAnswers, setPedagoAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setQcmAnswers(parsed.qcmAnswers || {});
        setPedagoAnswers(parsed.pedagoAnswers || {});
      }
    } catch {}
  }, [storageKey]);

  // autosave
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ qcmAnswers, pedagoAnswers })); } catch {}
  }, [storageKey, qcmAnswers, pedagoAnswers]);

  const onChangeQ1 = (id: string, val: any) => setQcmAnswers(prev => ({ ...prev, [id]: val }));
  const onChangeV2 = (id: string, val: any) => setPedagoAnswers(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`/api/bilan/${encodeURIComponent(bilanId)}/submit-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qcmAnswers, pedagoAnswers: requiresVolet2 ? pedagoAnswers : undefined }),
      });
      if (!resp.ok) throw new Error('submit failed');
      setSubmitted(true);
      try { localStorage.removeItem(storageKey); } catch {}
    } catch {
      setSubmitted(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Questionnaire du Bilan</h1>
      <Card>
        <CardHeader><CardTitle>Volet 1 — QCM ({subject} / {grade})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {q1.length === 0 ? <p>Aucune question disponible.</p> : q1.map(q => (
            <div key={q.id} className="space-y-2">
              <div className="font-medium">{q.statement}</div>
              {q.options?.map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2">
                  <input type="radio" name={q.id} checked={qcmAnswers[q.id] === idx} onChange={() => onChangeQ1(q.id, idx)} />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {requiresVolet2 && (
        <Card>
          <CardHeader><CardTitle>Volet 2 — Profil pédagogique</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {v2.length === 0 ? <p>Chargement du profil pédagogique…</p> : v2.map((q: any) => (
              <div key={q.id} className="space-y-2">
                <div className="font-medium">{q.label || q.title || q.id}</div>
                {Array.isArray(q.options) ? (
                  q.type === 'multi' ? (
                    q.options.map((opt: string, idx: number) => (
                      <label key={idx} className="flex items-center gap-2">
                        <input type="checkbox" checked={Array.isArray(pedagoAnswers[q.id]) && pedagoAnswers[q.id].includes(idx)} onChange={(e) => {
                          const arr = Array.isArray(pedagoAnswers[q.id]) ? [...pedagoAnswers[q.id]] : [];
                          if (e.target.checked) arr.push(idx); else arr.splice(arr.indexOf(idx), 1);
                          onChangeV2(q.id, arr);
                        }} />
                        <span>{opt}</span>
                      </label>
                    ))
                  ) : (
                    q.options.map((opt: string, idx: number) => (
                      <label key={idx} className="flex items-center gap-2">
                        <input type="radio" name={q.id} checked={pedagoAnswers[q.id] === idx} onChange={() => onChangeV2(q.id, idx)} />
                        <span>{opt}</span>
                      </label>
                    ))
                  )
                ) : q.type === 'text' ? (
                  <Textarea value={pedagoAnswers[q.id] || ''} onChange={e => onChangeV2(q.id, e.target.value)} />
                ) : (
                  <Input value={pedagoAnswers[q.id] || ''} onChange={e => onChangeV2(q.id, e.target.value)} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button disabled={saving} onClick={handleSubmit}>Soumettre</Button>
        {submitted && <span className="text-green-600">Soumission effectuée. Génération du rapport en cours…</span>}
      </div>
    </div>
  );
}
