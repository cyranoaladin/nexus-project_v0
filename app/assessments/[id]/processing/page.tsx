/**
 * Assessment Processing Page
 * 
 * Displays a loading screen while the assessment is being processed.
 * Polls the status API every 2 seconds and redirects when complete.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AssessmentStatusResponse {
  id: string;
  status: 'PENDING' | 'SCORING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string;
  result?: {
    globalScore: number;
    confidenceIndex: number;
    recommendations: string[];
  };
}

export default function AssessmentProcessingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [status, setStatus] = useState<AssessmentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/assessments/${params.id}/status`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Évaluation introuvable');
            return;
          }
          throw new Error('Erreur lors de la récupération du statut');
        }

        const data: AssessmentStatusResponse = await response.json();
        setStatus(data);
        setPollingCount((prev) => prev + 1);

        // Redirect when completed
        if (data.status === 'COMPLETED') {
          clearInterval(intervalId);
          setTimeout(() => {
            router.push(`/assessments/${params.id}/result`);
          }, 1000);
        }

        // Stop polling on failure
        if (data.status === 'FAILED') {
          clearInterval(intervalId);
          setError('Une erreur est survenue lors du traitement de votre évaluation.');
        }
      } catch (err) {
        console.error('Polling error:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        clearInterval(intervalId);
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 2 seconds
    intervalId = setInterval(pollStatus, 2000);

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [params.id, router]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Erreur</h1>
            <p className="text-lg text-slate-400">{error}</p>
          </div>
          <Button onClick={() => router.push('/')} variant="outline">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Status icon */}
        <div className="relative">
          {status?.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto animate-in zoom-in duration-500" />
          ) : (
            <Loader2 className="w-24 h-24 text-primary mx-auto animate-spin" />
          )}
        </div>

        {/* Status message */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold">
            {status?.status === 'COMPLETED' ? 'Analyse terminée !' : 'Analyse en cours...'}
          </h1>
          <p className="text-xl text-slate-400">
            {status?.message || 'Initialisation...'}
          </p>
        </div>

        {/* Progress bar */}
        {status && (
          <div className="space-y-2">
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-500">{status.progress}% complété</p>
          </div>
        )}

        {/* Status details */}
        <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-left space-y-3">
          <h2 className="text-lg font-semibold">Étapes du traitement</h2>
          <div className="space-y-2">
            <StatusStep
              label="Réception des réponses"
              completed={status !== null}
              active={status?.status === 'PENDING'}
            />
            <StatusStep
              label="Calcul des scores"
              completed={Boolean(status && ['SCORING', 'GENERATING', 'COMPLETED'].includes(status.status))}
              active={status?.status === 'SCORING'}
            />
            <StatusStep
              label="Génération du bilan personnalisé"
              completed={status?.status === 'COMPLETED' || false}
              active={status?.status === 'GENERATING'}
            />
          </div>
        </div>

        {/* Polling info */}
        <p className="text-xs text-slate-600">
          Vérification automatique... ({pollingCount} requêtes)
        </p>
      </div>
    </div>
  );
}

/**
 * Status step component
 */
function StatusStep({
  label,
  completed,
  active,
}: {
  label: string;
  completed: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all
          ${completed ? 'bg-primary border-primary' : active ? 'border-primary' : 'border-slate-600'}
        `}
      >
        {completed && <CheckCircle2 className="w-4 h-4 text-white" />}
        {active && !completed && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
      </div>
      <span
        className={`
          text-sm transition-colors
          ${completed ? 'text-slate-200' : active ? 'text-slate-300' : 'text-slate-500'}
        `}
      >
        {label}
      </span>
    </div>
  );
}
