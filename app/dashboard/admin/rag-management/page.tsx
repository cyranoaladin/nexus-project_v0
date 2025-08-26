'use client';

import RagDocumentList, { Document } from '@/components/admin/RagDocumentList';
import RagUploader from '@/components/admin/RagUploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';

export default function RagManagementPage() {
  const isE2E = process.env.NEXT_PUBLIC_E2E === '1';
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/rag/documents', { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur de chargement');
        const data = await res.json();
        setDocs(data.documents || []);
      } catch (e: any) {
        setError(e?.message || 'Erreur');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Mode E2E: rendre au moins l'uploader visible sans dépendre des données
  if (isE2E) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ingestion de Documents</CardTitle>
            <CardDescription>
              Téléversez un fichier Markdown (.md) contenant des métadonnées YAML pour l'ajouter à
              la mémoire du RAG.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RagUploader />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingestion de Documents</CardTitle>
          <CardDescription>
            Téléversez un fichier Markdown (.md) contenant des métadonnées YAML pour l'ajouter à la
            mémoire du RAG.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RagUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base de Connaissances Actuelle</CardTitle>
          <CardDescription>
            Consultez la liste des documents actuellement dans la mémoire d'ARIA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RagDocumentList documents={docs} isLoading={loading} error={error} />
        </CardContent>
      </Card>
    </div>
  );
}
