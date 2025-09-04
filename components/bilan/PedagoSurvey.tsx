"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import surveyCommun from "@/data/pedago_survey_commun.json";

type Question = { id: string; type: string; statement: string; options?: string[]; scale?: number; };

export default function PedagoSurvey({ answers, onChange, onPrev, onNext, survey }: { answers: any; onChange: (a: any) => void; onPrev: () => void; onNext: () => void; survey?: { questions: Question[]; }; }) {
  const set = (k: string, v: any) => onChange({ ...answers, [k]: v });
  const qlist: Question[] = survey?.questions || (surveyCommun as any).questions || [];

  const renderSingle = (q: Question) => (
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

  const renderMulti = (q: Question) => {
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
        {/* Champ libre si "Autre" est sélectionné */}
        {(() => {
          const autreIndex = (q.options || []).findIndex(o => /autre/i.test(o));
          if (autreIndex >= 0 && arr.includes(autreIndex)) {
            return (
              <div className="pt-2">
                <Label className="text-sm">Précisez</Label>
                <Input
                  data-testid={`other-input-${q.id}`}
                  aria-label={`Précisez (${q.statement})`}
                  placeholder="Précisez"
                  value={answers[`${q.id}_autre`] || ''}
                  onChange={(e) => set(`${q.id}_autre`, e.target.value)}
                />
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  const renderLikert = (q: Question) => {
    const scale = q.scale || 5;
    const val = Number(answers[q.id] ?? Math.ceil(scale / 2));
    const setVal = (n: number) => set(q.id, n);
    return (
      <div className="space-y-2">
        <Label className="font-medium">{q.statement}</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: scale }).map((_, i) => (
            <label key={i} className={`px-3 py-1 border rounded cursor-pointer ${val === i + 1 ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`} onClick={() => setVal(i + 1)}>
              <input type="radio" name={q.id} checked={val === i + 1} readOnly className="mr-2" />{i + 1}
            </label>
          ))}
        </div>
      </div>
    );
  };

  const renderField = (q: Question) => {
    if (q.type === 'single') return renderSingle(q);
    if (q.type === 'multi') return renderMulti(q);
    if (q.type === 'likert') return renderLikert(q);
    if (q.type === 'text') return (
      <div className="space-y-2">
        <Label className="font-medium">{q.statement}</Label>
        <Textarea value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />
      </div>
    );
    return (
      <div className="space-y-2">
        <Label className="font-medium">{q.statement}</Label>
        <Input value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="wizard-pedago">
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Volet 2 — Profil pédagogique (Commun)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qlist.map((q) => (
            <div key={q.id} className="p-3 bg-white border rounded space-y-2">
              {renderField(q)}
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
