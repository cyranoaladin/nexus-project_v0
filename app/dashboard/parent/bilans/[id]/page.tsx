'use client';

/**
 * Parent-facing bilan detail (P7b-2). Mirrors the real, existing student
 * page (`/dashboard/eleve/bilans/[publicShareId]`) but calls the generic
 * `GET /api/bilans/[id]` route directly — already correctly scoped for
 * PARENT via `buildBilanReadWhere` (own child + isPublished only) — and
 * renders `parentsMarkdown`, never `studentMarkdown` or `nexusMarkdown`
 * (the API itself already strips the latter for non-staff roles).
 */

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

interface BilanData {
  id: string;
  type: string;
  subject: string;
  parentsMarkdown: string | null;
  globalScore: number | null;
  createdAt: string;
  publishedAt: string | null;
}

export default function ParentBilanPage() {
  const params = useParams();
  const router = useRouter();
  const bilanId = params.id as string;

  const [bilan, setBilan] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bilanId) return;

    fetch(`/api/bilans/${bilanId}`)
      .then((res) => {
        if (res.status === 401) { router.push('/auth/signin'); return null; }
        if (res.status === 404) throw new Error('Ce bilan est introuvable ou n\'est pas encore disponible.');
        if (!res.ok) throw new Error('Erreur lors du chargement du bilan.');
        return res.json();
      })
      .then((data) => { if (data) setBilan(data.data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bilanId, router]);

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

  if (error || !bilan || bilan.parentsMarkdown === null) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
        <div className="bg-surface-card border border-white/10 rounded-xl max-w-md p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-white text-lg font-bold mb-2">Bilan introuvable</h2>
          <p className="text-neutral-400 text-sm mb-6">{error || 'Ce bilan n\'est pas disponible.'}</p>
          <Link href="/dashboard/parent" className="inline-flex items-center gap-2 text-brand-accent hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const subjectLabel = SUBJECT_LABELS[bilan.subject] ?? bilan.subject;
  const publishedDate = bilan.publishedAt
    ? new Date(bilan.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(bilan.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-surface-darker">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/dashboard/parent"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-brand-accent text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>

        <Card className="border-white/10 bg-surface-card" data-testid="aria-parent-bilan-detail">
          <CardHeader className="flex flex-row items-center gap-3">
            <FileText className="w-8 h-8 text-brand-accent shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-brand-accent">Bilan ARIA</p>
              <CardTitle className="text-white">{subjectLabel}</CardTitle>
              <p className="text-xs text-neutral-500">Publié le {publishedDate}</p>
            </div>
            {bilan.globalScore !== null && (
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold text-brand-accent">{bilan.globalScore}%</p>
                <p className="text-[10px] text-neutral-500">Score global</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm text-neutral-200">{bilan.parentsMarkdown}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
