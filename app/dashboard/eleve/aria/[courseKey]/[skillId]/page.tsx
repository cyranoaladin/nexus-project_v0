import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload } from '@/lib/aria/cockpit/builder';
import { AriaChatBox } from '@/components/aria/cockpit/AriaChatBox';
import { AriaSkillTree } from '@/components/aria/cockpit/AriaSkillTree';
import { getSkillGraph, type AriaCompetency, type AriaDomain } from '@/lib/aria/curriculum/skill-graph';
import { isKnownCourseKey } from '@/lib/aria/curriculum';
import { ArrowLeft, Target } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface AriaSkillFocusPageProps {
  params: Promise<{ courseKey: string; skillId: string }>;
}

export default async function AriaSkillFocusPage({ params }: AriaSkillFocusPageProps) {
  const { courseKey, skillId } = await params;

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

  const skillGraph = getSkillGraph(courseKey);
  if (!skillGraph) {
    notFound();
  }

  // Recherche de la compétence dans les domaines
  let targetCompetency: AriaCompetency | null = null;
  let targetDomain: AriaDomain | null = null;

  for (const domain of skillGraph.domains) {
    const found = domain.competencies.find(
      (c) => c.rawSkillId === skillId || c.id === skillId
    );
    if (found) {
      targetCompetency = found;
      targetDomain = domain;
      break;
    }
  }

  if (!targetCompetency || !targetDomain) {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Header focus compétence */}
      <div className="p-4 sm:p-5 rounded-2xl border border-sky-500/20 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href={`/dashboard/eleve/aria/${courseKey}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors mt-0.5"
            title="Retour à l'espace de cours"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-sky-400 font-medium mb-1">
              <Target className="w-3.5 h-3.5" />
              <span>{targetDomain.label}</span>
              {targetCompetency.chapterId && (
                <span className="font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                  {targetCompetency.chapterId}
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-100 leading-snug">
              {targetCompetency.label}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium">
            Entraînement guidé
          </span>
        </div>
      </div>

      {/* Grid Chat + Arborescence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[500px]">
          <AriaChatBox
            courseKey={courseKey}
            skillId={targetCompetency.rawSkillId}
          />
        </div>

        <div className="lg:col-span-5 xl:col-span-4 space-y-6 overflow-y-auto max-h-[800px] pr-1">
          <AriaSkillTree
            courseKey={courseKey}
            graph={skillGraph}
            activeSkillId={targetCompetency.rawSkillId}
          />
        </div>
      </div>
    </div>
  );
}
