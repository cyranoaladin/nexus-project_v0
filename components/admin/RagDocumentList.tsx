'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

export interface Document {
  document_id: string;
  contenu: string;
  metadata: {
    titre?: string;
    matiere?: string;
    niveau?: string;
    chapitre?: string;
    [key: string]: any;
  };
}

interface RagDocumentListProps {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
}

export default function RagDocumentList({ documents, isLoading, error }: RagDocumentListProps) {
  if (isLoading) {
    return <p>Chargement des documents...</p>;
  }

  if (error) {
    return <p className="text-red-500">Erreur: {error}</p>;
  }

  if (documents.length === 0) {
    return <p>Aucun document n'a encore été ingéré.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Documents Ingérés</h3>
      <Accordion type="single" collapsible className="w-full">
        {documents.map((doc) => (
          <AccordionItem value={doc.document_id} key={doc.document_id}>
            <AccordionTrigger>
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">{doc.metadata.titre || 'Titre non défini'}</span>
                <div className="flex gap-2 mt-1">
                  {doc.metadata.matiere && <Badge variant="outline">{doc.metadata.matiere}</Badge>}
                  {doc.metadata.niveau && <Badge variant="default">{doc.metadata.niveau}</Badge>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{doc.contenu}</ReactMarkdown>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
