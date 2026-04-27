'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  FileText, 
  Plus,
  X,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentType, DocumentVisibilityScope, Subject } from '@prisma/client';
import { cn } from '@/lib/utils';

interface StudentDocumentsManagerProps {
  studentId: string;
  studentName: string;
  onDocumentCreated?: () => void;
}

export default function StudentDocumentsManager({ 
  studentId, 
  studentName,
  onDocumentCreated 
}: StudentDocumentsManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.COURS);
  const [subject, setSubject] = useState<Subject | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<DocumentVisibilityScope>(
    DocumentVisibilityScope.STUDENT_AND_COACH
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    if (!url.trim() && !localPath.trim()) {
      toast.error('URL ou chemin local requis');
      return;
    }

    try {
      setIsCreating(true);

      const res = await fetch(`/api/assistante/students/${studentId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          subject,
          title: title.trim(),
          description: description.trim() || undefined,
          url: url.trim() || undefined,
          localPath: localPath.trim() || undefined,
          visibilityScope,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create document');
      }

      toast.success('Document créé avec succès');
      
      // Reset form
      setTitle('');
      setDescription('');
      setUrl('');
      setLocalPath('');
      setShowForm(false);
      
      onDocumentCreated?.();
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Documents de {studentName}</CardTitle>
          <CardDescription>
            Gérez les documents partagés avec cet élève
          </CardDescription>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? (
            <><X className="h-4 w-4 mr-2" /> Annuler</>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Ajouter</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium">Nouveau document</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Type *</label>
                <Select 
                  value={documentType} 
                  onValueChange={(v) => setDocumentType(v as DocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DocumentType.COURS}>Cours</SelectItem>
                    <SelectItem value={DocumentType.EXERCICE}>Exercice</SelectItem>
                    <SelectItem value={DocumentType.BILAN}>Bilan</SelectItem>
                    <SelectItem value={DocumentType.CORRECTION}>Correction</SelectItem>
                    <SelectItem value={DocumentType.PLANNING}>Planning</SelectItem>
                    <SelectItem value={DocumentType.ANNEXE}>Annexe</SelectItem>
                    <SelectItem value={DocumentType.AUTRE}>Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Matière</label>
                <Select 
                  value={subject} 
                  onValueChange={(v) => setSubject(v as Subject)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non spécifié" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Non spécifié</SelectItem>
                    <SelectItem value={Subject.MATHEMATIQUES}>Mathématiques</SelectItem>
                    <SelectItem value={Subject.PHYSIQUE_CHIMIE}>Physique-Chimie</SelectItem>
                    <SelectItem value={Subject.SVT}>SVT</SelectItem>
                    <SelectItem value={Subject.HISTOIRE_GEO}>Histoire-Géo</SelectItem>
                    <SelectItem value={Subject.FRANCAIS}>Français</SelectItem>
                    <SelectItem value={Subject.PHILOSOPHIE}>Philosophie</SelectItem>
                    <SelectItem value={Subject.ANGLAIS}>Anglais</SelectItem>
                    <SelectItem value={Subject.ESPAGNOL}>Espagnol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Titre *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du document"
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle"
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">URL</label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Chemin local</label>
                <Input
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/path/to/file..."
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Visibilité</label>
              <Select 
                value={visibilityScope} 
                onValueChange={(v) => setVisibilityScope(v as DocumentVisibilityScope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DocumentVisibilityScope.STUDENT_ONLY}>Élève uniquement</SelectItem>
                  <SelectItem value={DocumentVisibilityScope.STUDENT_AND_COACH}>Élève et coach</SelectItem>
                  <SelectItem value={DocumentVisibilityScope.STUDENT_AND_PARENT}>Élève et parent</SelectItem>
                  <SelectItem value={DocumentVisibilityScope.STUDENT_PARENT_COACH}>Élève, parent et coach</SelectItem>
                  <SelectItem value={DocumentVisibilityScope.ADMIN_ONLY}>Admin uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowForm(false)}
                disabled={isCreating}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isCreating || !title.trim() || (!url.trim() && !localPath.trim())}
              >
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" /> Créer</>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="text-center py-4 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">
            Utilisez le bouton &quot;Ajouter&quot; pour partager un document avec {studentName}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
