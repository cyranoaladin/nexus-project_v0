import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import MathsRevisionClient from '@/app/programme/maths-1ere/components/MathsRevisionClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@prisma/client';

type GeneratedSkillGraph = {
  programmeKey: string;
  sections: Array<{
    domainId: string;
    normalizedTitle: string;
    candidates: Array<{ normalizedLabel: string }>;
  }>;
};

async function loadGeneratedSkillGraph(ref: string): Promise<GeneratedSkillGraph> {
  const filePath = path.join(process.cwd(), 'programmes', 'generated', `${ref}.skills.generated.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as GeneratedSkillGraph;
}

export default async function DashboardEleveMathsProgrammePage() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: UserRole; firstName?: string; name?: string } | undefined;

  if (!sessionUser?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/eleve/programme/maths');
  }

  if (sessionUser.role !== UserRole.ELEVE) {
    redirect('/dashboard');
  }

  const student = await prisma.student.findUnique({
    where: { userId: sessionUser.id },
    select: { academicTrack: true },
  });

  if (!student) {
    redirect('/dashboard/eleve');
  }

  const isStmg = student.academicTrack === 'STMG' || student.academicTrack === 'STMG_NON_LYCEEN';

  if (!isStmg) {
    const displayName = sessionUser.firstName?.trim() || sessionUser.name?.split(' ')[0] || 'Élève';
    return <MathsRevisionClient user={{ id: sessionUser.id, name: displayName }} />;
  }

  const graph = await loadGeneratedSkillGraph('maths_premiere_stmg');

  return (
    <main className="min-h-screen bg-surface-darker px-4 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/eleve" className="inline-flex items-center gap-2 text-sm text-brand-accent hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour dashboard
        </Link>

        <section className="space-y-2">
          <p className="text-sm font-medium text-brand-accent">Première STMG</p>
          <h1 className="text-2xl font-semibold text-white">Mathématiques STMG</h1>
          <p className="max-w-3xl text-sm text-neutral-400">
            Structure chargée depuis le skill graph généré {graph.programmeKey}.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {graph.sections.map((section) => (
            <Card key={section.domainId} className="border-white/10 bg-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <BookOpen className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                  {section.normalizedTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.candidates.map((candidate) => (
                    <li key={candidate.normalizedLabel} className="flex gap-2 text-sm text-neutral-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                      <span>{candidate.normalizedLabel}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
