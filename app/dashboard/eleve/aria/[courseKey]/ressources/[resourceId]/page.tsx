import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload } from '@/lib/aria/cockpit/builder';
import { AriaChatBox } from '@/components/aria/cockpit/AriaChatBox';
import { AriaResourceList } from '@/components/aria/cockpit/AriaResourceList';
import { getResource, listResourcesForCourse } from '@/lib/aria/resources';
import { isKnownCourseKey } from '@/lib/aria/curriculum';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface AriaResourceFocusPageProps {
  params: Promise<{ courseKey: string; resourceId: string }>;
}

export default async function AriaResourceFocusPage({ params }: AriaResourceFocusPageProps) {
  const { courseKey, resourceId } = await params;

  if (!isKnownCourseKey(courseKey)) {
    notFound();
  }

  const session = await auth();
  if (!session?.user || session.user.role !== 'ELEVE') {
    redirect('/connexion');
  }

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: {
      academicEnrollments: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!student) {
    redirect('/dashboard/eleve');
  }

  const payload = await buildAriaCockpitPayload({
    student,
    requestedCourseKey: courseKey,
  });

  const courseSummary = payload.courses.find((c) => c.courseKey === courseKey);
  if (!courseSummary || !courseSummary.access.academicallyRelevant) {
    notFound();
  }

  const resource = getResource(resourceId);
  if (!resource || resource.courseKey !== courseKey) {
    notFound();
  }

  const allCourseResources = listResourcesForCourse(courseKey);
  const downloadUrl = `/api/aria/resources/${resource.id}/content`;

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Header focus document */}
      <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href={`/dashboard/eleve/aria/${courseKey}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors mt-0.5"
            title="Retour à l'espace de cours"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{resource.sourceLabel}</span>
              <span className="font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase">
                {resource.type}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100 leading-snug">
              {resource.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Consulter le PDF officiel</span>
          </a>
        </div>
      </div>

      {/* Grid Chat + Liste des documents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[500px]">
          <AriaChatBox
            courseKey={courseKey}
            resourceId={resource.id}
          />
        </div>

        <div className="lg:col-span-5 xl:col-span-4 space-y-6 overflow-y-auto max-h-[800px] pr-1">
          <AriaResourceList
            courseKey={courseKey}
            resources={allCourseResources}
            activeResourceId={resource.id}
          />
        </div>
      </div>
    </div>
  );
}
