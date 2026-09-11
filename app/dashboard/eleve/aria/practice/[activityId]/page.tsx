'use client';

/**
 * /dashboard/eleve/aria/practice/[activityId] — real practice-taking flow
 * (P5): view a real Activity's prompt, submit a real answer, get a real
 * AI correction. Closes the loop the Next Best Action CTA opens — this is
 * the first UI surface that actually exercises P2a/P2b's practice/correction
 * APIs, not just the read-only Mastery/NBA projections built on top of them.
 *
 * `?courseKey=` is required in the URL: there is no single-activity read
 * endpoint (only `GET /api/aria/practice/activities?courseKey=`, list-only
 * by design — see list-activities.ts), so this page fetches the course's
 * activity list and finds the one matching `activityId` client-side. A
 * dedicated single-activity endpoint is future scope if this filtering
 * ever becomes a real cost at real course sizes.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface McqPrompt {
  readonly questionText: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
}
interface ShortAnswerPrompt {
  readonly questionText: string;
}
interface ActivitySummary {
  readonly activityId: string;
  readonly courseKey: string;
  readonly activityType: 'MCQ' | 'SHORT_ANSWER';
  readonly prompt: McqPrompt | ShortAnswerPrompt;
}
interface CorrectionFeedback {
  readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
}

const OUTCOME_LABELS: Record<CorrectionFeedback['outcome'], string> = {
  CORRECT: 'Correct',
  PARTIALLY_CORRECT: 'Partiellement correct',
  INCORRECT: 'À revoir',
};
const OUTCOME_TONE: Record<CorrectionFeedback['outcome'], string> = {
  CORRECT: 'text-emerald-300',
  PARTIALLY_CORRECT: 'text-amber-300',
  INCORRECT: 'text-rose-300',
};

type Stage = 'loading' | 'answering' | 'working' | 'result' | 'error';

export default function AriaPracticeAttemptPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ activityId: string }>();
  const searchParams = useSearchParams();
  const courseKey = searchParams.get('courseKey');

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [feedback, setFeedback] = useState<CorrectionFeedback | null>(null);

  const load = useCallback(async () => {
    if (!courseKey) {
      setError('Cours manquant dans le lien.');
      setStage('error');
      return;
    }
    setStage('loading');
    setError(null);
    try {
      const response = await fetch(`/api/aria/practice/activities?courseKey=${courseKey}`);
      if (!response.ok) throw new Error('Chargement de l’exercice impossible.');
      const body = (await response.json()) as { activities: readonly ActivitySummary[] };
      const found = body.activities.find((entry) => entry.activityId === params.activityId);
      if (!found) throw new Error('Exercice introuvable.');
      setActivity(found);
      setStage('answering');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur inconnue');
      setStage('error');
    }
  }, [courseKey, params.activityId]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ELEVE') {
      router.push('/auth/signin');
      return;
    }
    void load();
  }, [session, status, router, load]);

  const submitAndCorrect = useCallback(async () => {
    if (!activity) return;
    setStage('working');
    setError(null);
    try {
      const startResponse = await fetch('/api/aria/practice/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity.activityId }),
      });
      if (!startResponse.ok) throw new Error('Impossible de démarrer la tentative.');
      const { attempt } = (await startResponse.json()) as { attempt: { id: string } };

      const payload =
        activity.activityType === 'MCQ' ? { selectedOptionId } : { answerText };
      const submitResponse = await fetch(`/api/aria/practice/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      if (!submitResponse.ok) throw new Error('Impossible de soumettre ta réponse.');

      const correctResponse = await fetch(`/api/aria/practice/attempts/${attempt.id}/correct`, {
        method: 'POST',
      });
      if (!correctResponse.ok) throw new Error('Impossible de corriger ta réponse.');
      const { result } = (await correctResponse.json()) as { result: { feedback: CorrectionFeedback } };
      setFeedback(result.feedback);
      setStage('result');
    } catch (caught) {
      // Stay on the answering form (never the full-page error state, and
      // never discard the student's selected option/typed text) so a
      // transient failure is just retryable, not a dead end.
      setError(caught instanceof Error ? caught.message : 'Erreur inconnue');
      setStage('answering');
    }
  }, [activity, selectedOptionId, answerText]);

  const backHref = '/dashboard/eleve/aria';

  if (status === 'loading' || stage === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-surface-darker">
        <Loader2 className="h-6 w-6 animate-spin text-brand-accent" aria-label="Chargement" />
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-surface-darker text-center">
        <AlertCircle className="h-6 w-6 text-rose-400" aria-hidden="true" />
        <p className="text-sm text-neutral-300">{error ?? 'Erreur inconnue'}</p>
        <Button size="sm" onClick={() => router.push(backHref)}>
          Retour au cockpit
        </Button>
      </div>
    );
  }

  if (!activity) return null;

  const canSubmit =
    activity.activityType === 'MCQ' ? selectedOptionId !== '' : answerText.trim() !== '';

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 text-neutral-100">
      <button
        type="button"
        onClick={() => router.push(backHref)}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-brand-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour au cockpit
      </button>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle className="text-white">{activity.prompt.questionText}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === 'result' && feedback ? (
            <div className="space-y-3" data-testid="aria-practice-result">
              <p className={`flex items-center gap-2 text-lg font-semibold ${OUTCOME_TONE[feedback.outcome]}`}>
                {feedback.outcome === 'CORRECT' ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <XCircle className="h-5 w-5" aria-hidden="true" />
                )}
                {OUTCOME_LABELS[feedback.outcome]}
              </p>
              <p className="text-sm text-neutral-300">{feedback.summary}</p>
              {feedback.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-400">Points forts</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-neutral-300">
                    {feedback.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-400">À améliorer</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-neutral-300">
                    {feedback.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button size="sm" onClick={() => router.push(backHref)} className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90">
                Retour au cockpit
              </Button>
            </div>
          ) : (
            <>
              {activity.activityType === 'MCQ' ? (
                <RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId}>
                  {(activity.prompt as McqPrompt).options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                      <Label htmlFor={`option-${option.id}`} className="flex-1 cursor-pointer text-sm text-neutral-200">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  placeholder="Ta réponse..."
                  className="border-white/10 bg-white/5 text-neutral-100"
                  data-testid="aria-practice-answer-text"
                />
              )}
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <Button
                onClick={() => void submitAndCorrect()}
                disabled={!canSubmit || stage === 'working'}
                className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
                data-testid="aria-practice-submit"
              >
                {stage === 'working' ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    Correction en cours…
                  </>
                ) : (
                  'Valider ma réponse'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
