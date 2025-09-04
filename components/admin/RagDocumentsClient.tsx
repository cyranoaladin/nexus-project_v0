"use client";

import { useEffect, useState } from 'react';
import RagDocumentList from '@/components/admin/RagDocumentList';

export default function RagDocumentsClient() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/admin/rag/documents', { credentials: 'include' });
      const js = await r.json();
      if (!r.ok) throw new Error(js?.error || 'Erreur');
      setDocs(js.documents || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return <RagDocumentList documents={docs} isLoading={loading} error={error} />;
}
