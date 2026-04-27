'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  FileText, 
  Download, 
  Eye,
  BookOpen,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentType, Subject } from '@prisma/client';
import { cn } from '@/lib/utils';

// Types
interface Document {
  id: string;
  documentType: DocumentType;
  subject: Subject | null;
  title: string;
  description: string | null;
  url: string | null;
  localPath: string | null;
  visibilityScope: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    firstName: string;
    lastName: string;
  };
}

interface StudentDocumentsProps {
  studentId: string;
  studentName: string;
}

const documentTypeLabels: Record<DocumentType, string> = {
  [DocumentType.COURS]: 'Cours',
  [DocumentType.EXERCICE]: 'Exercice',
  [DocumentType.BILAN]: 'Bilan',
  [DocumentType.CORRECTION]: 'Correction',
  [DocumentType.PLANNING]: 'Planning',
  [DocumentType.ANNEXE]: 'Annexe',
  [DocumentType.AUTRE]: 'Autre',
};

const documentTypeIcons: Record<DocumentType, React.ReactNode> = {
  [DocumentType.COURS]: <BookOpen className="h-4 w-4" />,
  [DocumentType.EXERCICE]: <FileText className="h-4 w-4" />,
  [DocumentType.BILAN]: <FileText className="h-4 w-4" />,
  [DocumentType.CORRECTION]: <FileText className="h-4 w-4" />,
  [DocumentType.PLANNING]: <Calendar className="h-4 w-4" />,
  [DocumentType.ANNEXE]: <FileText className="h-4 w-4" />,
  [DocumentType.AUTRE]: <FileText className="h-4 w-4" />,
};

const subjectLabels: Partial<Record<Subject, string>> = {
  [Subject.NON_SPECIFIE]: 'Non spécifié',
  [Subject.MATHS]: 'Mathématiques',
  [Subject.PHYSIQUE_CHIMIE]: 'Physique-Chimie',
  [Subject.SVT]: 'SVT',
  [Subject.HISTOIRE_GEO]: 'Histoire-Géo',
  [Subject.FRANCAIS]: 'Français',
  [Subject.PHILOSOPHIE]: 'Philosophie',
  [Subject.ANGLAIS]: 'Anglais',
  [Subject.ESPAGNOL]: 'Espagnol',
  [Subject.ALLEMAND]: 'Allemand',
  [Subject.ITALIEN]: 'Italien',
  [Subject.SES]: 'SES',
  [Subject.NSI]: 'NSI',
  [Subject.ARTS]: 'Arts',
  [Subject.EPS]: 'EPS',
};

export default function StudentDocuments({ studentId, studentName }: StudentDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const res = await fetch(`/api/coach/students/${studentId}/documents`);
        
        if (res.status === 403) {
          setError("Vous n'êtes pas assigné à cet élève");
          return;
        }
        
        if (!res.ok) throw new Error('Failed to fetch documents');
        
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setError('Erreur lors du chargement des documents');
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      fetchDocuments();
    }
  }, [studentId]);

  const handleOpenDocument = (doc: Document) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else if (doc.localPath) {
      toast.info('Téléchargement du document...');
    } else {
      toast.error('Document non disponible');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents de {studentName}
        </CardTitle>
        <CardDescription>
          {documents.length} document{documents.length !== 1 ? 's' : ''} partagé{documents.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">
              Aucun document partagé avec cet élève
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-md",
                    doc.documentType === DocumentType.COURS && "bg-blue-100 text-blue-700",
                    doc.documentType === DocumentType.EXERCICE && "bg-green-100 text-green-700",
                    doc.documentType === DocumentType.BILAN && "bg-purple-100 text-purple-700",
                    doc.documentType === DocumentType.CORRECTION && "bg-orange-100 text-orange-700",
                    doc.documentType === DocumentType.PLANNING && "bg-yellow-100 text-yellow-700",
                  )}>
                    {documentTypeIcons[doc.documentType]}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{doc.title}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {documentTypeLabels[doc.documentType]}
                      </Badge>
                      {doc.subject && subjectLabels[doc.subject] && (
                        <Badge variant="secondary" className="text-xs">
                          {subjectLabels[doc.subject]}
                        </Badge>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDocument(doc)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {(doc.url || doc.localPath) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDocument(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
