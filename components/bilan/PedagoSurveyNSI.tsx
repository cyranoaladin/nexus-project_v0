"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
export default function PedagoSurveyNSI({ answers, survey, onChange, onPrev, onNext }: { answers: Record<string, any>; survey: any; onChange: (a: any) => void; onPrev: () => void; onNext: () => void; }) {
  const set = (k: string, v: any) => onChange({ ...answers, [k]: v });

  const renderLikert = (q: any) => (
    <div className="space-y-2">
      <Label className="font-medium">{q.statement}</Label>
      <div className="flex flex-wrap gap-2">
        {[1,2,3,4,5].map((v) => (
          <label key={v} className={`px-3 py-2 border rounded cursor-pointer ${answers[q.id] === v ? 'border-blue-600' : 'border-slate-200'}`} onClick={() => set(q.id, v)}>
            <input type="radio" name={q.id} checked={answers[q.id] === v} readOnly className="mr-2" />{v}
          </label>
        ))}
      </div>
    </div>
  );

  const renderSingle = (q: any) => (
    <div className="space-y-2">
      <Label className="font-medium">{q.statement}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(q.options || []).map((opt: string, i: number) => (
          <label key={i} className={`px-3 py-2 border rounded cursor-pointer ${answers[q.id] === i ? 'border-blue-600' : 'border-slate-200'}`} onClick={() => set(q.id, i)}>
            <input type="radio" name={q.id} checked={answers[q.id] === i} readOnly className="mr-2" />{opt}
          </label>
        ))}
      </div>
    </div>
  );

  const renderMulti = (q: any) => {
    const arr: number[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
    const toggle = (idx: number) => {
      const has = arr.includes(idx);
      const next = has ? arr.filter((x) => x !== idx) : [...arr, idx];
      set(q.id, next);
    };
    return (
      <div className="space-y-2">
        <Label className="font-medium">{q.statement}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(q.options || []).map((opt: string, i: number) => (
            <label key={i} className={`px-3 py-2 border rounded cursor-pointer ${arr.includes(i) ? 'border-blue-600' : 'border-slate-200'}`} onClick={() => toggle(i)}>
              <input type="checkbox" checked={arr.includes(i)} readOnly className="mr-2" />{opt}
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="wizard-pedago-nsi">
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Volet 2 — Profil pédagogique NSI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(survey?.questions || []).map((q: any) => (
            <div key={q.id} className="p-3 bg-white border rounded space-y-2">
              {q.type === 'likert' && renderLikert(q)}
              {q.type === 'single' && renderSingle(q)}
              {q.type === 'multi' && renderMulti(q)}
            </div>
          ))}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onPrev}>Précédent</Button>
            <Button onClick={onNext} data-testid="wizard-results">Voir les résultats</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

