'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SUBJECT_LABELS: Record<string, string> = {
  FRANCAIS: 'Français',
  MATHEMATIQUES: 'Mathématiques',
  MATHS_STMG: 'Mathématiques STMG',
  NSI: 'NSI',
  DROIT_ECO: 'Droit-Économie',
  MANAGEMENT: 'Management',
  SGN: 'Sciences de gestion et numérique',
  MIXTE: 'Multi-matières',
};

const TYPE_LABELS: Record<string, string> = {
  STAGE_POST: 'Bilan de stage',
  DIAGNOSTIC_PRE_STAGE: 'Bilan diagnostic',
  ASSESSMENT_QCM: 'Bilan QCM',
  CONTINUOUS: 'Bilan continu',
};

interface BilanData {
  id: string;
  publicShareId: string;
  type: string;
  subject: string;
  studentMarkdown: string;
  globalScore: number | null;
  createdAt: string;
  publishedAt: string | null;
  coach: {
    user: { firstName: string | null; lastName: string | null };
    pseudonym: string;
  } | null;
}

export default function StudentBilanPage() {
  const params = useParams();
  const router = useRouter();
  const publicShareId = params.publicShareId as string;

  const [bilan, setBilan] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicShareId) return;

    fetch(`/api/student/bilans/${publicShareId}`)
      .then((res) => {
        if (res.status === 401) { router.push('/auth/signin'); return null; }
        if (res.status === 404) throw new Error('Ce bilan est introuvable ou n\'est pas encore disponible.');
        if (!res.ok) throw new Error('Erreur lors du chargement du bilan.');
        return res.json();
      })
      .then((data) => { if (data) setBilan(data.bilan); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [publicShareId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-neutral-400">Chargement du bilan...</p>
        </div>
      </div>
    );
  }

  if (error || !bilan) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
        <div className="bg-surface-card border border-white/10 rounded-xl max-w-md p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-white text-lg font-bold mb-2">Bilan introuvable</h2>
          <p className="text-neutral-400 text-sm mb-6">{error || 'Ce bilan n\'est pas disponible.'}</p>
          <Link href="/dashboard/eleve" className="inline-flex items-center gap-2 text-brand-accent hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const subjectLabel = SUBJECT_LABELS[bilan.subject] ?? bilan.subject;
  const typeLabel = TYPE_LABELS[bilan.type] ?? bilan.type;
  const publishedDate = bilan.publishedAt
    ? new Date(bilan.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(bilan.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-surface-darker">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/dashboard/eleve#bilans"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-brand-accent text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à mes bilans
        </Link>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10">
                <FileText className="h-5 w-5 text-brand-accent" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-accent font-semibold mb-1">
                  {typeLabel}
                </p>
                <CardTitle className="text-white text-lg">{subjectLabel}</CardTitle>
                <p className="text-xs text-neutral-500 mt-1">
                  Publié le {publishedDate}
                  {bilan.coach && (
                    <span>
                      {' · '}Coach {bilan.coach.pseudonym || [bilan.coach.user.firstName, bilan.coach.user.lastName].filter(Boolean).join(' ')}
                    </span>
                  )}
                </p>
              </div>
              {bilan.globalScore != null && (
                <div className="ml-auto shrink-0 text-right">
                  <p className="text-2xl font-bold text-white">{Math.round(bilan.globalScore)}%</p>
                  <p className="text-xs text-neutral-500">Score global</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-200 leading-relaxed">
              {bilan.studentMarkdown}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
