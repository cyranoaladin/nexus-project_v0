"use client";

import { QCM_QUESTIONS } from "@/lib/scoring/qcmData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function QCMSeconde({ answers, onChange, onNext, questions }: { answers: Record<string, any>; onChange: (a: any) => void; onNext: () => void; questions?: typeof QCM_QUESTIONS; }) {
  const setAnswer = (id: string, value: any) => onChange({ ...answers, [id]: value });
  const qs = questions || QCM_QUESTIONS;

  return (
    <div className="space-y-4" data-testid="wizard-qcm">
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Volet 1 — QCM (démo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qs.map((q) => (
            <div key={q.id} className="space-y-2 p-3 rounded-md bg-white border">
              <div className="text-sm font-medium">{q.id}. {q.prompt}</div>
              {q.type === "single" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options?.map((opt) => (
                    <label key={opt.key} className={`border rounded px-3 py-2 cursor-pointer ${answers[q.id] === opt.key ? 'border-blue-600' : 'border-slate-200'}`}
                      onClick={() => setAnswer(q.id, opt.key)}>
                      <input type="radio" name={q.id} checked={answers[q.id] === opt.key} readOnly className="mr-2" />
                      {opt.key}. {opt.label}
                    </label>
                  ))}
                </div>
              ) : (
                <Input placeholder="Votre réponse" value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <Button onClick={onNext} data-testid="wizard-next">Suivant</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
