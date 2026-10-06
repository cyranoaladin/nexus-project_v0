import type { Metadata } from 'next';

import { formatDateTime } from '@/lib/espace/format';
import { getLegacyArchiveView } from '@/lib/espace/legacy/snapshot';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { getOrganizationTimezone } from '@/lib/timezone';

export const metadata: Metadata = { title: 'Archives POO historiques' };
export const dynamic = 'force-dynamic';

export default async function LegacyArchivesPage() {
  await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/archives-poo');
  const view = await getLegacyArchiveView();
  const tz = getOrganizationTimezone();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-50">Archives POO historiques</h1>
      <p className="max-w-prose text-sm text-neutral-300">
        Ces traces viennent de l’ancien TP. Elles sont conservées telles quelles et en lecture seule : aucune n’est associée à un élève sans votre décision explicite.
      </p>

      {view.state === 'ABSENT' && (
        <p className="rounded-lg border border-white/10 p-4 text-neutral-300" data-testid="archives-empty">Aucune archive importée dans l’espace.</p>
      )}
      {view.state === 'INVALID' && (
        <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-amber-100">Le fichier d’inventaire est illisible ou non conforme : régénérez-le avec la commande « inventory ».</p>
      )}

      {view.state === 'READY' && (
        <>
          <p className="text-sm text-neutral-300">
            Inventaire du {formatDateTime(view.generatedAt, tz)} · {view.count} dépôt{view.count > 1 ? 's' : ''} · empreinte de la source{' '}
            <code className="break-all text-xs">{view.sourceSha256.slice(0, 16)}…</code>
          </p>
          {view.traces.length === 0 ? (
            <p className="rounded-lg border border-white/10 p-4 text-neutral-300">L’archive ne contient aucun dépôt.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <caption className="sr-only">Traces de l’ancien TP POO</caption>
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
                  <tr>
                    <th scope="col" className="px-3 py-2">Identifiant</th>
                    <th scope="col" className="px-3 py-2">Alias</th>
                    <th scope="col" className="px-3 py-2">Reçu</th>
                    <th scope="col" className="px-3 py-2">Progression</th>
                    <th scope="col" className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {view.traces.map((t) => (
                    <tr key={t.id}>
                      <th scope="row" className="px-3 py-2 font-mono text-xs font-normal text-neutral-200">{t.id}</th>
                      <td className="px-3 py-2 text-neutral-100">{t.alias}</td>
                      <td className="px-3 py-2 text-neutral-300">{t.received}</td>
                      <td className="px-3 py-2 tabular-nums text-neutral-200">{t.summary ? `${t.summary.completedSteps}/${t.summary.requiredSteps}` : <span title={t.problem ?? undefined}>illisible</span>}</td>
                      <td className="px-3 py-2">{t.status === 'ASSOCIE' ? <span className="text-emerald-200">Associé à {t.linkedTo}</span> : <span className="text-neutral-300">Non associé</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <section aria-labelledby="associer" className="rounded-xl border border-white/10 bg-surface-card p-4">
        <h2 id="associer" className="text-base font-semibold text-neutral-50">Associer une trace à un élève</h2>
        <p className="mt-1 max-w-prose text-sm text-neutral-300">
          L’association est manuelle, depuis le serveur, et ne se fait jamais depuis cette page. Vous choisissez la trace <em>et</em> l’élève : rien n’est déduit d’un alias, d’un nom ou d’un style de code. Vérifiez d’abord (aucune écriture), puis confirmez avec le jeton affiché.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 text-xs leading-6 text-neutral-100"><code>{`# 1. Inventaire (lecture seule) et instantané pour cette page
npx tsx scripts/espace/legacy-poo.ts inventory --db <archive.sqlite3> --snapshot-out ''

# 2. Aperçu : ne modifie rien, affiche le jeton de confirmation
npx tsx scripts/espace/legacy-poo.ts plan --db <archive.sqlite3> --trace <identifiant> --student <identifiant.élève>

# 3. Rattachement, seulement après votre décision
npx tsx scripts/espace/legacy-poo.ts link --db <archive.sqlite3> --trace <identifiant> --student <identifiant.élève> \\
  --confirm 'LINK:<identifiant>:<identifiant.élève>' --as <votre.identifiant> --execute`}</code></pre>
        <p className="mt-2 text-xs text-neutral-400">Un alias partagé par plusieurs dépôts est refusé : utilisez alors l’identifiant de trace. La source n’est jamais modifiée ni supprimée.</p>
      </section>
    </div>
  );
}
