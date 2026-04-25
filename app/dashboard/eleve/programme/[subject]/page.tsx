import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@prisma/client';

type SubjectPageProps = {
  params: Promise<{ subject: string }>;
};

const SUBJECT_TO_GRAPH: Record<string, string> = {
  nsi: 'nsi_premiere',
  physique_chimie: 'physique_chimie_premiere',
  svt: 'svt_premiere',
  francais: 'francais_premiere',
  philosophie: 'philosophie_premiere',
  histoire_geo: 'histoire_geo_premiere',
  anglais: 'anglais_premiere',
  sgn: 'sgn_premiere_stmg',
  management: 'management_premiere_stmg',
  droit_eco: 'droit_eco_premiere_stmg',
};

type GeneratedSkillGraph = {
  programmeKey: string;
  sections: Array<{
    domainId: string;
    normalizedTitle: string;
    candidates: Array<{ normalizedLabel: string }>;
  }>;
};

async function tryLoadGraph(ref: string): Promise<GeneratedSkillGraph | null> {
  try {
    const filePath = path.join(process.cwd(), 'programmes', 'generated', `${ref}.skills.generated.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as GeneratedSkillGraph;
  } catch {
    return null;
  }
}

export default async function DashboardEleveSubjectProgrammePage({ params }: SubjectPageProps) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: UserRole } | undefined;

  if (!sessionUser?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/eleve');
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

  const { subject } = await params;
  const graphRef = SUBJECT_TO_GRAPH[subject];

  if (!graphRef) {
    notFound();
  }

  const graph = await tryLoadGraph(graphRef);

  return (
    <main className="min-h-screen bg-surface-darker px-4 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/eleve" className="inline-flex items-center gap-2 text-sm text-brand-accent hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour dashboard
        </Link>

        <section className="space-y-2">
          <p className="text-sm font-medium text-brand-accent">{student.academicTrack}</p>
          <h1 className="text-2xl font-semibold text-white">{subject.replaceAll('_', ' ')}</h1>
          <p className="max-w-3xl text-sm text-neutral-400">
            {graph ? `Structure chargée depuis ${graph.programmeKey}.` : 'Structure prête; contenu pédagogique à enrichir via le pipeline programmes.'}
          </p>
        </section>

        {graph ? (
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
                  <ul className="space-y-2 text-sm text-neutral-300">
                    {section.candidates.map((candidate) => (
                      <li key={candidate.normalizedLabel}>{candidate.normalizedLabel}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-white/10 bg-surface-card">
            <CardContent className="p-6 text-sm text-neutral-400">
              Le skill graph correspondant n'est pas encore généré.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
