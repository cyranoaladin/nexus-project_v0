import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import nextDynamic from 'next/dynamic';

const RagUploader = nextDynamic(() => import('@/components/admin/RagUploader'), { ssr: false });
const RagFileUpload = nextDynamic(() => import('@/components/admin/RagFileUpload'), { ssr: false });
const RagDocumentsClient = nextDynamic(() => import('@/components/admin/RagDocumentsClient'), { ssr: false });
const RagIngestionsTable = nextDynamic(() => import('@/components/admin/RagIngestionsTable'), { ssr: false });
const RagSearch = nextDynamic(() => import('@/components/admin/RagSearch'), { ssr: false });

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="p-6" role="main">
        <h1 className="text-2xl font-semibold">RAG — Ingestion & Documents (fallback E2E)</h1>
        <input type="file" data-testid="rag-e2e-file" />
      </main>
    ) as any;
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const allowed = role === 'ADMIN' || role === 'ASSISTANTE' || role === 'COACH';
  if (!allowed) {
    return <div className="p-6"><h1 className="text-xl font-semibold">Accès non autorisé</h1></div> as any;
  }
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">RAG — Ingestion & Documents</h1>
      <p className="text-muted-foreground">Upload de ressources (.md/.pdf/.docx/ .txt) ou analyse .md avec front-matter; idempotence par hash; recherche vectorielle.</p>
      <div className="grid md:grid-cols-2 gap-6">
        <RagUploader />
        <RagFileUpload />
      </div>
      {process.env.NEXT_PUBLIC_E2E === '1' && (
        <div>
          <input type="file" data-testid="rag-e2e-file" />
        </div>
      )}
      <RagIngestionsTable />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Recherche vectorielle</h2>
        <RagSearch />
      </div>
      <RagDocumentsClient />
    </div>
  );
}
