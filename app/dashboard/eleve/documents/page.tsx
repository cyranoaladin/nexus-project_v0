'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  FileText, 
  Download, 
  ExternalLink,
  BookOpen,
  Calendar,
  Eye
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

const subjectLabels: Record<Subject, string> = {
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

export default function EleveDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'STUDENT') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch documents
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'STUDENT') return;

    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        
        // Get student profile to get studentId
        const profileRes = await fetch('/api/student/profile');
        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profileData = await profileRes.json();
        
        if (!profileData.student?.id) {
          throw new Error('Student ID not found');
        }

        // Fetch documents via student-specific endpoint
        const res = await fetch(`/api/students/${profileData.student.id}/documents`);
        if (!res.ok) throw new Error('Failed to fetch documents');
        
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast.error('Erreur lors du chargement des documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [status, session]);

  const handleOpenDocument = (doc: Document) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else if (doc.localPath) {
      // For local files, we would need a download endpoint
      toast.info('Téléchargement du document...');
      // window.open(`/api/documents/download/${doc.id}`, '_blank');
    } else {
      toast.error('Document non disponible');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mes Documents</h1>
        <p className="text-muted-foreground">
          Accédez à vos cours, exercices, bilans et autres documents pédagogiques
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucun document</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Vous n&apos;avez pas encore de documents partagés. 
              Votre coach ou l&apos;équipe Nexus pourra bientôt vous en partager.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      doc.documentType === DocumentType.COURS && "bg-blue-100 text-blue-700",
                      doc.documentType === DocumentType.EXERCICE && "bg-green-100 text-green-700",
                      doc.documentType === DocumentType.BILAN && "bg-purple-100 text-purple-700",
                      doc.documentType === DocumentType.CORRECTION && "bg-orange-100 text-orange-700",
                      doc.documentType === DocumentType.PLANNING && "bg-yellow-100 text-yellow-700",
                    )}>
                      {documentTypeIcons[doc.documentType]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {documentTypeLabels[doc.documentType]}
                        </Badge>
                        {doc.subject && (
                          <Badge variant="secondary">
                            {subjectLabels[doc.subject]}
                          </Badge>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-muted-foreground text-sm mt-2">
                          {doc.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Ajouté le {new Date(doc.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDocument(doc)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ouvrir
                    </Button>
                    {(doc.url || doc.localPath) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDocument(doc)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
