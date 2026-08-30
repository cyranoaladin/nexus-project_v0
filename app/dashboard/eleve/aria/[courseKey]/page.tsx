import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload } from '@/lib/aria/cockpit/builder';
import { AriaChatBox } from '@/components/aria/cockpit/AriaChatBox';
import { AriaSkillTree } from '@/components/aria/cockpit/AriaSkillTree';
import { AriaResourceList } from '@/components/aria/cockpit/AriaResourceList';
import { AriaRagStatusBadge } from '@/components/aria/cockpit/AriaRagStatusBadge';
import { isKnownCourseKey } from '@/lib/aria/curriculum';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface AriaCoursePageProps {
  params: Promise<{ courseKey: string }>;
  searchParams: Promise<{ conversationId?: string }>;
}

export default async function AriaCoursePage({ params, searchParams }: AriaCoursePageProps) {
  const { courseKey } = await params;
  const { conversationId } = await searchParams;

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

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Header matière */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/eleve/aria"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title="Retour au cockpit"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
              <span>{courseSummary.label}</span>
              <AriaRagStatusBadge
                hasRagCorpus={courseSummary.capabilities.hasRagCorpus}
                ragCollection={courseSummary.capabilities.ragCollection}
              />
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {courseSummary.longLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            {courseSummary.capabilities.hasSkillGraph ? 'Compétences actives' : 'Tronc commun'}
          </span>
          <span className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            {courseSummary.capabilities.resourceCount} ressources
          </span>
        </div>
      </div>

      {/* Cockpit layout à 2 colonnes (Chat + Panneau latéral compétences/ressources) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
        {/* Colonne Chat principal (7/12 sur desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[500px]">
          <AriaChatBox
            courseKey={courseKey}
            conversationId={conversationId}
          />
        </div>

        {/* Colonne latérale Compétences & Documents (5/12 sur desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 overflow-y-auto max-h-[800px] pr-1">
          {payload.activeSkillGraph && (
            <AriaSkillTree
              courseKey={courseKey}
              graph={payload.activeSkillGraph}
            />
          )}

          {payload.activeResources && payload.activeResources.length > 0 && (
            <AriaResourceList
              courseKey={courseKey}
              resources={payload.activeResources}
            />
          )}
        </div>
      </div>
    </div>
  );
}
