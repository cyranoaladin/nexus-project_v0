'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Volet2Form from '@/components/forms/Volet2Form';
import { Loader2 } from 'lucide-react';

// Copied from Volet2Form.tsx for type safety
type Volet2Schema = {
  meta: {
    title: string;
    version: string;
    locale: string;
    sectionsOrder: string[];
  };
  optionsPresets: Record<string, string[]>;
  likertPresets: Record<string, string[]>;
  sections: Record<string, any>;
};

export default function Volet2Page() {
  const [schema, setSchema] = useState<Volet2Schema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const bilanId = params.bilanId as string;

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch('/forms/volet2_schema.json');
        const data = await response.json();
        setSchema(data);
      } catch (error) {
        console.error("Failed to load Volet 2 schema:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchema();
  }, []);

  const handleFormSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/bilan/${bilanId}/volet2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save Volet 2 data');
      }

      // Redirect to the main bilan page after successful submission
      router.push(`/dashboard/student/bilan/${bilanId}`);

    } catch (error) {
      console.error("Submission failed:", error);
      // TODO: Show an error message to the user
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  if (!schema) {
    return <p>Erreur: Le schéma du formulaire n'a pas pu être chargé.</p>;
  }

  return <Volet2Form schema={schema} onFormSubmit={handleFormSubmit} />;
}



