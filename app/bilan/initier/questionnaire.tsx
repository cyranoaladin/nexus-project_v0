"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

type QcmQuestion = { id: string; domain?: string; weight?: number; type?: string; statement: string; options?: string[]; answer?: number; };
type QcmPayload = { meta?: any; questions: QcmQuestion[]; };

export default function Questionnaire({ data, studentId, subject, grade }: { data: { qcm: QcmPayload; pedago: any; hasPedago: boolean; }; studentId: string; subject: string; grade: string; }) {
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, number | number[]>>({});
  const [pedagoAnswers, setPedagoAnswers] = useState<Record<string, any>>({});
  const hasPedago = !!data?.hasPedago;

  const qcm = data?.qcm || { questions: [] };
  const pedago = data?.pedago || { questions: [] };

  const onSubmit = async () => {
    const res = await fetch('/api/bilan/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, subject, grade, qcmAnswers, pedagoAnswers: hasPedago ? undefined : pedagoAnswers })
    });
    const j = await res.json();
    if (!res.ok) alert(j.error || 'Erreur');
    else window.location.href = `/dashboard/eleve/bilan/${j.bilanId}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Volet 1 — QCM {subject} ({grade})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qcm.questions?.slice(0, 10).map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>{q.statement}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(q.options || []).map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2 p-2 border rounded">
                    <input type="radio" name={q.id} onChange={() => setQcmAnswers(a => ({ ...a, [q.id]: idx }))} checked={qcmAnswers[q.id] === idx} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {!hasPedago && (
        <Card>
          <CardHeader>
            <CardTitle>Volet 2 — Questionnaire pédagogique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(pedago.questions || []).map((p: any) => (
              <div key={p.id} className="space-y-2">
                <Label>{p.statement || p.question}</Label>
                {p.type === 'text' ? (
                  <Textarea onChange={(e) => setPedagoAnswers(a => ({ ...a, [p.id]: e.target.value }))} />
                ) : p.type === 'single' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(p.options || []).map((opt: string, idx: number) => (
                      <label key={idx} className="flex items-center gap-2 p-2 border rounded">
                        <input type="radio" name={p.id} onChange={() => setPedagoAnswers(a => ({ ...a, [p.id]: idx }))} checked={pedagoAnswers[p.id] === idx} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : p.type === 'multi' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(p.options || []).map((opt: string, idx: number) => {
                      const arr = Array.isArray(pedagoAnswers[p.id]) ? pedagoAnswers[p.id] as number[] : [];
                      const checked = arr.includes(idx);
                      return (
                        <label key={idx} className="flex items-center gap-2 p-2 border rounded">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setPedagoAnswers(a => {
                              const cur = Array.isArray(a[p.id]) ? [...(a[p.id] as number[])] : [];
                              if (e.target.checked) { if (!cur.includes(idx)) cur.push(idx); } else { const i = cur.indexOf(idx); if (i >= 0) cur.splice(i, 1); }
                              return { ...a, [p.id]: cur };
                            });
                          }} />
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <Input onChange={(e) => setPedagoAnswers(a => ({ ...a, [p.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onSubmit}>Valider le bilan</Button>
      </div>
    </div>
  );
}
