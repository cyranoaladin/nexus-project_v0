export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  const slug = 'cgv';
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  try {
    const res = await fetch(`${base}/api/legal/${slug}`, { next: { tags: ['legal', `legal:${slug}`] } });
    if (res.ok) {
      const { title, contentHtml, updatedAt, version, contentHash, gitCommit } = await res.json();
      return (
        <article className="prose prose-slate mx-auto px-4 py-8">
          <h1>{title}</h1>
          <p className="text-sm text-muted-foreground">
            Version {version} • Mis à jour le {new Date(updatedAt).toLocaleDateString('fr-FR')} • Hash: {String(contentHash).slice(0, 8)} {gitCommit ? <> • Commit: {String(gitCommit).slice(0, 7)}</> : null}
          </p>
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </article>
      );
    }
  } catch {}
  return (
    <article className="prose prose-slate mx-auto px-4 py-8">
      <h1>Conditions Générales de Vente</h1>
      <p className="text-sm text-muted-foreground">Version e2e-stub</p>
      <div>
        <p>Document légal (fallback E2E).</p>
      </div>
    </article>
  );
}
