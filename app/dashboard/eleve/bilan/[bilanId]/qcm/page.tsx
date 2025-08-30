// app/dashboard/eleve/bilan/[bilanId]/qcm/page.tsx
'use client';
import React, { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QCM_PREMIERE_MATHS } from '@/lib/bilan/qcm-premiere-maths';

export default function BilanQcmPage() {
  const router = useRouter();
  const params = useParams() as { bilanId: string };
  const questions = useMemo(()=>QCM_PREMIERE_MATHS, []);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  function setAnswer(qid: string, idx: number) {
    setAnswers(prev => ({ ...prev, [qid]: idx }));
  }

  async function onSubmit() {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/bilan/${params.bilanId}/qcm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Soumission QCM échouée');
      router.push(`/dashboard/eleve/bilan/${params.bilanId}/profil`);
    } catch (e: any) {
      alert(e?.message || 'Erreur');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>QCM — Programme de Seconde (Entrée en Première)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {questions.map(q => (
            <div key={q.id} className="border rounded p-3">
              <div className="font-medium mb-2">{q.id}. {q.text}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.choices.map((c, idx) => (
                  <label key={c.label} className="flex items-center gap-2">
                    <input type="radio" name={q.id} checked={answers[q.id]===idx} onChange={()=>setAnswer(q.id, idx)} />
                    <span>{c.label}. {c.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button data-testid="qcm-submit" onClick={onSubmit} disabled={submitting}>{submitting?'Envoi...':'Valider le QCM'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

