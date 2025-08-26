// components/admin/RagUploader.tsx
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import * as yaml from 'js-yaml';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface DocumentMetadata {
  titre?: string;
  matiere?: string;
  niveau?: string;
  mots_cles?: string[];
  [key: string]: any;
}

interface RagUploaderProps {
  onIngestSuccess?: () => void;
}

export default function RagUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setMetadata(null);
      setContent('');
      setError('');
      setSuccess('');
    }
  };

  const handleParseFile = async () => {
    if (!file) {
      setError("Veuillez d'abord sélectionner un fichier.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const yamlRegex = /^---([\s\S]*?)---/;
        const match = text.match(yamlRegex);

        if (!match) {
          throw new Error(
            "Aucun bloc de métadonnées YAML (entouré de ---) n'a été trouvé au début du fichier."
          );
        }

        const yamlContent = match[1];
        const parsedMetadata = yaml.load(yamlContent) as DocumentMetadata;
        const mainContent = text.replace(yamlRegex, '').trim();

        setMetadata(parsedMetadata);
        setContent(mainContent);
        setError('');
      } catch (err: any) {
        setError(`Erreur lors du parsing du fichier : ${err.message}`);
        setMetadata(null);
        setContent('');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!content || !metadata) {
      setError('Le contenu et les métadonnées ne peuvent pas être vides.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/rag-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu: content, metadata }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur inconnue est survenue.');
      }

      setSuccess(`Document ingéré avec succès ! ID du document : ${data.id}`);
      setFile(null);
      setMetadata(null);
      setContent('');
      // rafraîchissement côté client uniquement
      try {
        router.refresh();
      } catch {}
      try {
        router.refresh();
      } catch {}
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="file-upload">Fichier Markdown (.md)</Label>
        <Input
          id="file-upload"
          data-testid="rag-file-upload"
          type="file"
          accept=".md"
          onChange={handleFileChange}
        />
      </div>

      <Button onClick={handleParseFile} disabled={!file} data-testid="rag-analyse">
        Analyser le Fichier
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {metadata && content && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Aperçu du Document</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                value={(metadata.titre as string) || ''}
                readOnly
                disabled
                data-testid="rag-meta-titre"
              />
            </div>
            <div className="space-y-2">
              <Label>Matière</Label>
              <Input
                value={(metadata.matiere as string) || ''}
                readOnly
                disabled
                data-testid="rag-meta-matiere"
              />
            </div>
            <div className="space-y-2">
              <Label>Niveau</Label>
              <Input
                value={(metadata.niveau as string) || ''}
                readOnly
                disabled
                data-testid="rag-meta-niveau"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Métadonnées (JSON brut)</Label>
            <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
              <code>{JSON.stringify(metadata, null, 2)}</code>
            </pre>
          </div>

          <div className="space-y-2">
            <Label>Contenu Principal</Label>
            <Textarea value={content} readOnly rows={15} />
          </div>

          <Button onClick={handleSubmit} disabled={isLoading} data-testid="rag-ingest">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter à la Base de Connaissances d'ARIA
          </Button>
        </div>
      )}

      {success && (
        <Alert variant="default">
          <AlertTitle>Succès</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
