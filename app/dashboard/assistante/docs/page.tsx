import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

const DOC_ROOT = path.join(process.cwd(), 'docs');

const DOC_REGISTRY: Array<{ key: string; title: string; relativePath: string }> = [
  { key: '00_INDEX.md', title: '00 Index', relativePath: '00_INDEX.md' },
  { key: '10_CARTE_DU_SITE.md', title: '10 Carte du site', relativePath: '10_CARTE_DU_SITE.md' },
  { key: '20_GUIDE_NAVIGATION.md', title: '20 Guide navigation', relativePath: '20_GUIDE_NAVIGATION.md' },
  { key: '21_GUIDE_DASHBOARDS.md', title: '21 Guide dashboards', relativePath: '21_GUIDE_DASHBOARDS.md' },
  { key: '22_GUIDE_QUESTIONNAIRES_ET_BILANS.md', title: '22 Questionnaires & bilans', relativePath: '22_GUIDE_QUESTIONNAIRES_ET_BILANS.md' },
  { key: '23_GUIDE_COURS_RESSOURCES.md', title: '23 Cours & ressources', relativePath: '23_GUIDE_COURS_RESSOURCES.md' },
  { key: '30_AUTHENTIFICATION.md', title: '30 Authentification', relativePath: '30_AUTHENTIFICATION.md' },
  { key: '31_RBAC_MATRICE.md', title: '31 RBAC matrice', relativePath: '31_RBAC_MATRICE.md' },
  { key: '32_ENTITLEMENTS_ET_ABONNEMENTS.md', title: '32 Entitlements & abonnements', relativePath: '32_ENTITLEMENTS_ET_ABONNEMENTS.md' },
  { key: '33_SECURITE_ET_CONFORMITE.md', title: '33 Sécurité & conformité', relativePath: '33_SECURITE_ET_CONFORMITE.md' },
  { key: '40_LLM_RAG_PIPELINE.md', title: '40 LLM/RAG pipeline', relativePath: '40_LLM_RAG_PIPELINE.md' },
  { key: '50_QA_ET_TESTS.md', title: '50 QA & tests', relativePath: '50_QA_ET_TESTS.md' },
  { key: '60_DEPLOIEMENT_PROD.md', title: '60 Déploiement prod', relativePath: '60_DEPLOIEMENT_PROD.md' },
  { key: 'generated_routes.json', title: 'Generated routes.json', relativePath: '_generated/routes.json' },
  { key: 'generated_rbac_matrix.json', title: 'Generated rbac_matrix.json', relativePath: '_generated/rbac_matrix.json' },
  { key: 'generated_rbac_coverage.json', title: 'Generated rbac_coverage.json', relativePath: '_generated/rbac_coverage.json' },
];

function isAllowedRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'ASSISTANTE';
}

async function readDocument(relativePath: string): Promise<{ content: string; bytes: number } | null> {
  const filePath = path.join(DOC_ROOT, relativePath);

  if (!filePath.startsWith(DOC_ROOT)) {
    return null;
  }

  try {
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, 'utf8'),
      fs.stat(filePath),
    ]);
    return { content, bytes: stat.size };
  } catch {
    return null;
  }
}

export default async function InternalDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!isAllowedRole(role)) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const requested = params.doc;
  const selected = DOC_REGISTRY.find((d) => d.key === requested) ?? DOC_REGISTRY[0];
  const doc = await readDocument(selected.relativePath);

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <header className="border-b border-white/10 bg-surface-card/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold text-white">Documentation Interne (Read-only)</h1>
            <p className="text-xs text-neutral-400">Accès réservé ADMIN / ASSISTANTE</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/dashboard/assistante" className="rounded border border-white/15 px-3 py-2 text-neutral-200 hover:text-white">
              Retour dashboard assistante
            </Link>
            <Link href="/dashboard/admin" className="rounded border border-white/15 px-3 py-2 text-neutral-200 hover:text-white">
              Retour dashboard admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <aside className="rounded-lg border border-white/10 bg-surface-card/80 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Référentiel</p>
          <ul className="space-y-1 text-sm">
            {DOC_REGISTRY.map((entry) => {
              const active = entry.key === selected.key;
              return (
                <li key={entry.key}>
                  <Link
                    href={`/dashboard/assistante/docs?doc=${encodeURIComponent(entry.key)}`}
                    className={`block rounded px-2 py-1.5 ${active ? 'bg-white/15 text-white' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    {entry.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded-lg border border-white/10 bg-surface-card/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{selected.relativePath}</h2>
            <span className="text-xs text-neutral-400">{doc ? `${doc.bytes} bytes` : 'indisponible'}</span>
          </div>

          {doc ? (
            <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/20 p-3 text-xs text-neutral-200">
              {doc.content}
            </pre>
          ) : (
            <div className="rounded border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
              Fichier introuvable ou non lisible.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
