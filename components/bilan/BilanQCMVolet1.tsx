"use client";

import MarkdownPro from "@/components/MarkdownPro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AnyQuestion = any;
export default function BilanQCMVolet1({ answers, onChange, onNext, questions }: { answers: Record<string, any>; onChange: (a: any) => void; onNext: () => void; questions?: AnyQuestion[]; }) {
  const setAnswer = (id: string, value: any) => onChange({ ...answers, [id]: value });
  const qs: AnyQuestion[] = (questions && Array.isArray(questions) ? questions : ([] as AnyQuestion[]));

  const getPrompt = (q: AnyQuestion) => String(q.prompt_latex || q.prompt || "");
  const isMcq = (q: AnyQuestion) => (q.type === 'mcq' || q.type === 'single');
  const getChoices = (q: AnyQuestion) => {
    if (Array.isArray(q.choices)) return q.choices.map((c: any) => ({ key: c.k, label: c.latex || c.label }));
    if (Array.isArray(q.options)) return q.options.map((c: any) => ({ key: c.key, label: c.label }));
    return [] as { key: string; label: string; }[];
  };

  return (
    <div className="space-y-4" data-testid="wizard-qcm">
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Volet 1 — QCM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qs.map((q) => (
            <div key={q.id} className="space-y-2 p-3 rounded-md bg-white border">
              <div className="text-sm font-medium flex gap-2">
                <span>{q.id}.</span>
                <div className="flex-1">
                  <MarkdownPro content={getPrompt(q)} />
                </div>
              </div>
              {isMcq(q) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getChoices(q).map((opt: { key: string; label: string; }) => (
                    <label key={opt.key} className={`border rounded px-3 py-2 cursor-pointer ${answers[q.id] === opt.key ? 'border-blue-600' : 'border-slate-200'}`}
                      onClick={() => setAnswer(q.id, opt.key)}>
                      <input type="radio" name={q.id} checked={answers[q.id] === opt.key} readOnly className="mr-2" />
                      <span className="inline-flex gap-2">
                        <span>{opt.key}.</span>
                        <span className="flex-1"><MarkdownPro content={String(opt.label || '')} /></span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <Input placeholder="Votre réponse" value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
              )}
              {q.explanation_latex && (
                <div className="text-xs text-slate-600 border-t pt-2">
                  <MarkdownPro content={String(q.explanation_latex)} />
                </div>
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
