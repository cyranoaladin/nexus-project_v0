/**
 * Assessment Result Page
 * 
 * Displays the complete assessment results with tabs for different audiences.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';

interface AssessmentResult {
  id: string;
  subject: string;
  grade: string;
  studentName: string;
  studentEmail: string;
  globalScore: number;
  confidenceIndex: number;
  scoringResult: any;
  analysisJson: any;
  studentMarkdown: string;
  parentsMarkdown: string;
  createdAt: string;
}

export default function AssessmentResultPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/assessments/${params.id}/result`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Évaluation introuvable');
            return;
          }
          throw new Error('Erreur lors de la récupération des résultats');
        }

        const data: AssessmentResult = await response.json();
        setResult(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [params.id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-slate-400">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Erreur</h1>
            <p className="text-lg text-slate-400">{error || 'Résultats introuvables'}</p>
          </div>
          <Button onClick={() => router.push('/')} variant="outline">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  // Main result view
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Votre Bilan d'Excellence</h1>
              <p className="text-lg text-slate-400 mt-2">
                {result.subject === 'MATHS' ? 'Mathématiques' : 'NSI'} •{' '}
                {result.grade === 'PREMIERE' ? 'Première' : 'Terminale'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Partager
              </Button>
            </div>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg border border-primary/20">
              <div className="text-sm text-slate-400 mb-1">Score Global</div>
              <div className="text-4xl font-bold text-primary">{result.globalScore}/100</div>
              <div className="text-sm text-slate-300 mt-2">
                {result.globalScore >= 80 && '🎉 Excellent niveau !'}
                {result.globalScore >= 60 && result.globalScore < 80 && '👍 Bon niveau'}
                {result.globalScore >= 40 && result.globalScore < 60 && '📚 Niveau moyen'}
                {result.globalScore < 40 && '💪 Des efforts à fournir'}
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-lg border border-blue-500/20">
              <div className="text-sm text-slate-400 mb-1">Indice de Confiance</div>
              <div className="text-4xl font-bold text-blue-400">{result.confidenceIndex}/100</div>
              <div className="text-sm text-slate-300 mt-2">
                {result.confidenceIndex >= 80 && '✅ Très fiable'}
                {result.confidenceIndex >= 60 && result.confidenceIndex < 80 && '✓ Fiable'}
                {result.confidenceIndex < 60 && '⚠️ À confirmer'}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for different audiences */}
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student">Pour l'Élève</TabsTrigger>
            <TabsTrigger value="parents">Pour les Parents</TabsTrigger>
          </TabsList>

          <TabsContent value="student" className="space-y-4">
            <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{result.studentMarkdown}</ReactMarkdown>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parents" className="space-y-4">
            <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{result.parentsMarkdown}</ReactMarkdown>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => router.push('/dashboard')}>
            Retour au Dashboard
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-slate-500">
          <p>Évaluation réalisée le {new Date(result.createdAt).toLocaleDateString('fr-FR')}</p>
          <p className="mt-1">ID: {result.id}</p>
        </div>
      </div>
    </div>
  );
}
