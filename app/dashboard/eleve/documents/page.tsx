'use client';

import { useProtectedFetch, useCanonicalSession as useSession } from '@/components/auth/SessionRecoveryProvider';
import { EleveResources } from '@/components/dashboard/eleve/EleveResources';
import type { EleveResource } from '@/components/dashboard/eleve/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StudentDocument {
  id: string;
  title: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export default function EleveDocumentsPage() {
  const fetch = useProtectedFetch();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [resources, setResources] = useState<EleveResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const authority = session?.user?.authority;
  const role = session?.user?.role;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    else if (status === 'authenticated' && role !== 'ELEVE') router.push('/dashboard');
  }, [status, role, router]);

  useEffect(() => {
    if (status !== 'authenticated' || role !== 'ELEVE' || authority === 'CORE_V2') return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch('/api/student/documents');
        if (!response.ok) throw new Error('DOCUMENT_LIST_UNAVAILABLE');
        const data = await response.json() as { documents: StudentDocument[] };
        if (!cancelled) setResources(data.documents.map(doc => ({
          id: doc.id, type: 'USER_DOCUMENT', title: doc.title, sizeBytes: doc.sizeBytes,
          mimeType: doc.mimeType, uploadedAt: doc.createdAt,
          downloadUrl: `/api/student/documents/${encodeURIComponent(doc.id)}/download`,
        })));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, role, authority, fetch]);

  if (status === 'authenticated' && role === 'ELEVE' && authority === 'CORE_V2') {
    return <section className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Documents pédagogiques</h1>
      <p>Le partage de documents depuis cette page n’est pas encore disponible pour votre espace.</p>
      <Link href="/dashboard/eleve/diagnostics-libres" className="underline">Consulter mes diagnostics</Link>
    </section>;
  }
  if (status !== 'authenticated' || role !== 'ELEVE' || loading) return <div role="status" className="p-8"><Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />Chargement des documents…</div>;
  return <section className="max-w-5xl mx-auto p-6 space-y-6">
    <h1 className="text-2xl font-semibold">Mes Documents</h1>
    {failed ? <p role="alert">Impossible de charger les documents. Réessayez ultérieurement.</p> : <EleveResources resources={resources} />}
  </section>;
}
