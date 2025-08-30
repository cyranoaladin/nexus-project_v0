'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { BilanPremium } from '@prisma/client';

export default function AdminBilansPage() {
  const [bilans, setBilans] = useState<BilanPremium[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBilans = async () => {
      try {
        const response = await fetch('/api/admin/bilans');
        if (!response.ok) throw new Error('Failed to fetch bilans');
        const data = await response.json();
        setBilans(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBilans();
  }, []);

  const handleGenerate = async (bilanId: string) => {
    // Mettre à jour l'état local pour montrer que la génération est en cours
    setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, status: 'GENERATING' } : b));

    try {
      const response = await fetch(`/api/bilans/${bilanId}/generate`, { method: 'POST' });
      if (!response.ok) throw new Error('Generation failed');
      const updatedBilan = await response.json();
      // Mettre à jour avec le statut final
      setBilans(prev => prev.map(b => b.id === bilanId ? updatedBilan : b));
    } catch (error) {
      console.error('Failed to generate bilan:', error);
      // Remettre le statut à PENDING en cas d'erreur
      setBilans(prev => prev.map(b => b.id === bilanId ? { ...b, status: 'PENDING' } : b));
    }
  };
  
  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-16 h-16 animate-spin" /></div>;
  if (error) return <p className="text-red-500">Erreur: {error}</p>;

  return (
    <div className="container mx-auto p-4" data-testid="admin-bilans-page">
      <h1 className="text-3xl font-bold mb-6">Gestion des Bilans Premium</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {bilans.map(bilan => (
          <Card key={bilan.id} data-bilan-id={bilan.id} data-testid={`bilan-card-${bilan.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Bilan #{bilan.id.substring(0, 8)}</span>
                <span
                  data-testid={`status-${bilan.id}`}
                  className={`text-sm font-medium px-2 py-1 rounded-full ${
                  bilan.status === 'PENDING' ? 'bg-yellow-200 text-yellow-800' : 
                  bilan.status === 'GENERATING' ? 'bg-blue-200 text-blue-800' : 
                  'bg-green-200 text-green-800'
                }`}
                >
                  {bilan.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Élève ID: {bilan.studentId.substring(0, 8)}</p>
              <p>Créé le: {new Date(bilan.createdAt).toLocaleDateString()}</p>
            </CardContent>
            {bilan.status === 'PENDING' && (
              <Button data-testid={`generate-report-${bilan.id}`} onClick={() => handleGenerate(bilan.id)} className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                Générer le rapport
              </Button>
            )}
            {bilan.status === 'GENERATING' && (
               <Button disabled className="w-full">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération en cours...
              </Button>
            )}
             {bilan.status === 'READY' && bilan.pdfUrl && (
              <a data-testid={`download-report-${bilan.id}`} href={bilan.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full">Télécharger</Button>
              </a>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
