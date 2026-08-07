'use client';

import { Check, FileUp, HelpCircle } from 'lucide-react';
import type { DiagnosticAnswer, DiagnosticQuestion } from '@/lib/diagnostics/candidat-libre/types';
import { UploadPanel } from './UploadPanel';

interface Props {
  diagnosticId: string;
  question: DiagnosticQuestion;
  answer?: DiagnosticAnswer;
  disabled?: boolean;
  onChange: (answer: DiagnosticAnswer) => void;
}

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ');
}

export function QuestionRenderer({ diagnosticId, question, answer, disabled, onChange }: Props) {
  const value = answer?.value;
  const setValue = (next: DiagnosticAnswer['value'], status: DiagnosticAnswer['status'] = 'ANSWERED') => {
    onChange({ questionId: question.id, value: next, status, confidence: answer?.confidence, answeredAt: new Date().toISOString() });
  };

  if (question.type === 'information') {
    return <div className="whitespace-pre-line rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm leading-7 text-slate-200">{question.description ?? question.prompt}</div>;
  }

  if (question.type === 'upload' && question.uploadRule) {
    return (
      <UploadPanel
        diagnosticId={diagnosticId}
        question={question}
        disabled={disabled}
        onUploaded={() => setValue('UPLOADED')}
      />
    );
  }

  if (question.type === 'single') {
    return (
      <div className="grid gap-3">
        {question.options?.map((option) => {
          const selected = value === option.id && answer?.status !== 'NOT_STUDIED';
          return (
            <button key={option.id} type="button" disabled={disabled} onClick={() => setValue(option.id)}
              className={cx('flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-cyan-400/20', selected ? 'border-cyan-300 bg-cyan-400/15 text-white' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500')}>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-cyan-200 bg-cyan-300 text-slate-950' : 'border-slate-500')}>{selected && <Check className="h-3.5 w-3.5" />}</span>
              <span><strong className="mr-2 text-slate-400">{option.id.toUpperCase()}.</strong>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === 'multiple') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {question.options?.map((option) => {
          const active = selected.includes(option.id) && answer?.status !== 'NOT_STUDIED';
          return (
            <button key={option.id} type="button" disabled={disabled} onClick={() => setValue(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])}
              className={cx('flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-violet-400/20', active ? 'border-violet-300 bg-violet-400/15 text-white' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500')}>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border', active ? 'border-violet-200 bg-violet-300 text-slate-950' : 'border-slate-500')}>{active && <Check className="h-3.5 w-3.5" />}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === 'acknowledgement') {
    const checked = value === true;
    return (
      <button type="button" disabled={disabled} onClick={() => setValue(!checked)}
        className={cx('flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm transition', checked ? 'border-emerald-300 bg-emerald-400/10 text-emerald-50' : 'border-slate-700 bg-slate-950/50 text-slate-300')}>
        <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border', checked ? 'border-emerald-200 bg-emerald-300 text-slate-950' : 'border-slate-500')}>{checked && <Check className="h-3.5 w-3.5" />}</span>
        <span>Je confirme cette déclaration.</span>
      </button>
    );
  }

  if (question.type === 'scale') {
    const min = question.min ?? 1;
    const max = question.max ?? 5;
    const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
        <div className="flex flex-wrap gap-2">
          {values.map((item) => <button key={item} type="button" disabled={disabled} onClick={() => setValue(item)} className={cx('h-11 min-w-11 rounded-xl border px-3 text-sm font-bold transition', value === item ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500')}>{item}</button>)}
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{question.leftLabel}</span><span>{question.rightLabel}</span></div>
      </div>
    );
  }

  if (question.type === 'numeric') {
    return <input type="number" disabled={disabled} min={question.min} max={question.max} step={question.step ?? 'any'} value={typeof value === 'number' ? value : ''} onChange={(event) => setValue(event.target.value === '' ? null : Number(event.target.value))} placeholder={question.placeholder} className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/10" />;
  }

  const multiline = question.type === 'long';
  const text = typeof value === 'string' ? value : '';
  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea disabled={disabled} rows={question.wordLimit && question.wordLimit > 250 ? 12 : 7} value={text} onChange={(event) => setValue(event.target.value)} placeholder={question.placeholder} className="w-full resize-y rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/10" />
      ) : (
        <input disabled={disabled} value={text} onChange={(event) => setValue(event.target.value)} placeholder={question.placeholder} className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/10" />
      )}
      {question.wordLimit && <p className="text-right text-xs text-slate-500">{text.trim() ? text.trim().split(/\s+/).length : 0} / {question.wordLimit} mots conseillés</p>}
    </div>
  );
}

export function ConfidenceSelector({ answer, onChange }: { answer?: DiagnosticAnswer; onChange: (confidence: 0 | 1 | 2 | 3) => void }) {
  const labels = ['Au hasard', 'Peu sûr', 'Assez sûr', 'Très sûr'] as const;
  return <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><HelpCircle className="h-4 w-4" /> Degré de confiance</p><div className="flex flex-wrap gap-2">{labels.map((label, index) => <button type="button" key={label} onClick={() => onChange(index as 0|1|2|3)} className={cx('rounded-xl border px-3 py-2 text-xs transition', answer?.confidence === index ? 'border-cyan-300 bg-cyan-400/15 text-cyan-50' : 'border-slate-700 text-slate-400 hover:border-slate-500')}>{label}</button>)}</div></div>;
}

export function NotStudiedButton({ question, answer, onChange }: { question: DiagnosticQuestion; answer?: DiagnosticAnswer; onChange: (answer: DiagnosticAnswer) => void }) {
  if (!question.allowNotStudied) return null;
  const active = answer?.status === 'NOT_STUDIED';
  return <button type="button" onClick={() => onChange({ questionId: question.id, value: active ? null : 'NOT_STUDIED', status: active ? 'SKIPPED' : 'NOT_STUDIED', answeredAt: new Date().toISOString() })} className={cx('mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition', active ? 'border-amber-300 bg-amber-400/15 text-amber-100' : 'border-slate-700 text-slate-400 hover:border-amber-400/60')}><FileUp className="h-4 w-4" /> Notion non étudiée</button>;
}
