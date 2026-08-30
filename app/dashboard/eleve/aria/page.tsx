import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildAriaCockpitPayload } from '@/lib/aria/cockpit/builder';
import { AriaCourseCard } from '@/components/aria/cockpit/AriaCourseCard';
import { Sparkles, MessageSquare, ArrowRight, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AriaCockpitPage() {
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

  const payload = await buildAriaCockpitPayload({ student });

  const activeCourse = payload.courses.find(
    (c) => c.courseKey === payload.activeCourseKey
  );

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-900 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Accompagnement d'Excellence — Année 2026/2027</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Cockpit Pédagogique ARIA
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Travaillez avec méthode, explorez les attendus officiels du Ministère et consolidez vos
              compétences grâce au guidage socratique personnalisé.
            </p>
          </div>

          {activeCourse && activeCourse.access.status === 'AVAILABLE' && (
            <Link
              href={`/dashboard/eleve/aria/${activeCourse.courseKey}`}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition-all shadow-lg shadow-sky-950/60 shrink-0"
            >
              <span>Continuer en {activeCourse.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Mes Espaces de Cours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Mes Espaces de Cours</h2>
            <p className="text-xs text-slate-400">
              Sélectionnez une discipline pour accéder au chat socratique, aux compétences et aux documents officiels.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            Niveau {payload.student.gradeLevel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payload.courses.map((courseSummary) => (
            <AriaCourseCard
              key={courseSummary.courseKey}
              course={courseSummary}
              isSelected={courseSummary.courseKey === payload.activeCourseKey}
            />
          ))}
        </div>
      </div>

      {/* Conversations récentes */}
      {payload.recentConversations.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-semibold text-slate-200">Conversations Récentes</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {payload.recentConversations.map((conv) => (
              <Link
                key={conv.id}
                href={
                  conv.courseKey
                    ? `/dashboard/eleve/aria/${conv.courseKey}?conversationId=${conv.id}`
                    : `/dashboard/eleve/aria`
                }
                className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-xs font-medium text-slate-200 line-clamp-1 mb-1">
                    {conv.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(conv.updatedAt).toLocaleDateString('fr-FR')}</span>
                    {conv.courseKey && (
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                        {conv.courseKey}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-sky-400 font-medium flex items-center gap-1">
                  <span>Reprendre</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
