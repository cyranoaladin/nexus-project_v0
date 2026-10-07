import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BilanFamilyReport } from '@/components/espace/teacher/BilanFamilyReport';
import { BilanPrintButton } from '@/components/espace/teacher/BilanPrintButton';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { loadWorkForActor } from '@/lib/espace/access';
import { listAnnotations } from '@/lib/espace/annotations';
import { getBilanLevel } from '@/lib/espace/bilan-data';
import { EspaceError } from '@/lib/espace/errors';
import { toWorkDto } from '@/lib/espace/works';
import { fullName } from '@/lib/espace/overview';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Synthèse individuelle — bilan de septembre' };

export default async function BilanReportPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  const actor = await requireActorForPage(['COACH', 'ADMIN'], `/espace/enseignant/bilans/${workId}`);
  try {
    const { work } = await loadWorkForActor(actor, workId, 'teacher');
    const level = getBilanLevel(work.activity.slug);
    if (!level) notFound();
    const [annotations, student] = await Promise.all([listAnnotations(actor, work.id), prisma.user.findUniqueOrThrow({ where: { id: work.studentId }, select: { firstName: true, lastName: true } })]);
    const dto = toWorkDto(work);
    return <div className="space-y-5"><style>{`@media print { body, body > div, #main-content { background: white !important; color: #0f172a !important; } body > div > header, header:has(nav[aria-label="Navigation de l’espace"]) { display: none !important; } #main-content { max-width: none; padding: 0; } #bilan-family-report { font-size: 10pt; box-shadow: none; } #bilan-family-report h2, #bilan-family-report h3 { break-after: avoid; } @page { margin: 16mm; } }`}</style><div className="print:hidden flex flex-wrap items-center justify-between gap-3"><Link href={`/espace/enseignant/corriger/${workId}`} className="text-sm text-brand-accent underline">Revenir aux observations et compléter les priorités</Link><BilanPrintButton /></div><BilanFamilyReport studentName={fullName(student)} level={level} status={dto.status} steps={dto.content.steps} annotations={annotations} /></div>;
  } catch (error) {
    if (error instanceof EspaceError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) notFound();
    throw error;
  }
}
