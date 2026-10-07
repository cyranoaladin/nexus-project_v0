import Link from 'next/link';
import { BilanWorkbench } from '@/components/espace/student/BilanWorkbench';
import { requireActorForPage } from '@/lib/espace/page-guard';
import type { BilanLevel } from '@/lib/espace/bilan-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bilans de septembre — aperçu enseignant' };

export default async function TeacherBilansPage({ searchParams }: { searchParams: Promise<{ niveau?: string }> }) {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/bilans');
  const query = await searchParams;
  const level: BilanLevel = query.niveau === '2nde' ? '2nde' : '3e';
  return <div className="space-y-7"><section className="rounded-xl border border-white/15 p-4"><h2 className="text-lg font-semibold text-neutral-100">Préparer la passation</h2><p className="mt-2 text-sm text-neutral-300">Cet aperçu ne crée aucun travail d’élève. Attribuez une séance publiée du bilan au groupe concerné ; chaque élève répondra depuis son propre compte. Le questionnaire distingue contenus travaillés, auto-positionnement et essais.</p><nav className="mt-4 flex flex-wrap gap-3" aria-label="Niveau de l’aperçu">{(['3e', '2nde'] as const).map(n => <Link key={n} aria-current={level === n ? 'page' : undefined} href={`/espace/enseignant/bilans?niveau=${n}`} className={`rounded-lg border px-4 py-2 text-sm ${level === n ? 'border-brand-accent text-brand-accent' : 'border-white/20 text-neutral-200'}`}>{n === '3e' ? 'Aperçu troisième' : 'Aperçu seconde'}</Link>)}<Link href="/espace/enseignant/seances" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-neutral-200">Gérer les séances</Link></nav></section><BilanWorkbench key={level} preview userId={actor.id} studentName="Aperçu du questionnaire élève" level={level} work={{ id: `preview-${level}`, status: 'DRAFT', revision: 0, currentStep: 0, lastSavedAt: '', steps: {} }} annotations={[]} /></div>;
}
