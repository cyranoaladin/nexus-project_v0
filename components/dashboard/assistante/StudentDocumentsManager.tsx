'use client';

import { useProtectedFetch } from '@/components/auth/SessionRecoveryProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Plus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

interface StudentDocumentsManagerProps {
  userId: string;
  studentName: string;
  onDocumentCreated?: () => void;
}

const ACCEPTED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']);

export default function StudentDocumentsManager({ userId, studentName, onDocumentCreated }: StudentDocumentsManagerProps) {
  const fetch = useProtectedFetch();
  const inputId = useId();
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!file || !userId || isCreating) return;
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast.error('Choisissez un fichier autorisé de 10 Mo maximum.');
      return;
    }
    setIsCreating(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('userId', userId);
      const response = await fetch('/api/admin/documents', { method: 'POST', body });
      if (response.status !== 201) {
        toast.error("Le document n’a pas été déposé. Réessayez ultérieurement.");
        return;
      }
      setFile(null);
      setShowForm(false);
      toast.success('Document déposé avec succès');
      onDocumentCreated?.();
    } catch {
      toast.error("Le document n’a pas été déposé. Réessayez ultérieurement.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Documents de {studentName}</CardTitle>
          <CardDescription>Déposez un document accessible à cet élève.</CardDescription>
        </div>
        <Button size="sm" disabled={isCreating || !userId} onClick={() => { setFile(null); setShowForm(!showForm); }} variant={showForm ? 'outline' : 'default'}>
          {showForm ? <><X className="h-4 w-4 mr-2" /> Annuler</> : <><Plus className="h-4 w-4 mr-2" /> Ajouter</>}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/50">
            <label htmlFor={inputId} className="text-sm font-medium block">Fichier</label>
            <Input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" disabled={isCreating} onChange={event => setFile(event.target.files?.[0] ?? null)} />
            <p className="text-sm text-muted-foreground">PDF, JPEG, PNG, WebP ou texte, 10 Mo maximum. Le nom du fichier sert de titre. Le document est accessible à l’élève uniquement.</p>
            <Button onClick={handleSubmit} disabled={isCreating || !file}>
              {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi...</> : 'Envoyer'}
            </Button>
          </div>
        )}
        <div className="text-center py-4 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Utilisez le bouton &quot;Ajouter&quot; pour déposer un document pour {studentName}.</p>
        </div>
      </CardContent>
    </Card>
  );
}
