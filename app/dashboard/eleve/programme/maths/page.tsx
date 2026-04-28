import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardList, ExternalLink, Target } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import MathsRevisionClient from '@/app/programme/maths-1ere/components/MathsRevisionClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import mathsStmgQuestionModule from '@/lib/assessments/questions/maths/premiere/stmg';
import { UserRole } from '@prisma/client';

type GeneratedSkillGraph = {
  programmeKey: string;
  sections: Array<{
    domainId: string;
    normalizedTitle: string;
    candidates: Array<{ normalizedLabel: string }>;
  }>;
};

const STMG_LINKED_MODULES = [
  {
    title: 'Sciences de gestion et numérique',
    href: '/dashboard/eleve/programme/sgn',
    description: '8 domaines : organisation, acteur, processus, valeur, décision, SI et données.',
  },
  {
    title: 'Management',
    href: '/dashboard/eleve/programme/management',
    description: '4 domaines : organisation, objectifs, choix organisationnels et performance.',
  },
  {
    title: 'Droit-Économie',
    href: '/dashboard/eleve/programme/droit_eco',
    description: '4 domaines : droit, contrat, responsabilité, marché, financement et régulation.',
  },
  {
    title: 'Français EAF',
    href: 'https://eaf.nexusreussite.academy',
    description: 'Préparation EAF sur la plateforme dédiée Nexus.',
  },
];

function groupQuestionsByCategory() {
  const grouped = new Map<string, typeof mathsStmgQuestionModule.questions>();
  for (const question of mathsStmgQuestionModule.questions) {
    const current = grouped.get(question.category) ?? [];
    current.push(question);
    grouped.set(question.category, current);
  }
  return Array.from(grouped.entries());
}

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
  const skillCount = graph.sections.reduce((count, section) => count + section.candidates.length, 0);
  const groupedQuestions = groupQuestionsByCategory();

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
            Ressources attachées depuis le skill graph {graph.programmeKey}, la définition diagnostique STMG et la banque QCM Maths STMG.
          </p>
        </section>

        <section id="livret" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-surface-card">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Programme</p>
              <p className="mt-2 text-2xl font-semibold text-white">{graph.sections.length}</p>
              <p className="text-sm text-neutral-400">domaines STMG</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-surface-card">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Compétences</p>
              <p className="mt-2 text-2xl font-semibold text-white">{skillCount}</p>
              <p className="text-sm text-neutral-400">points du skill graph</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-surface-card">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-neutral-500">QCM</p>
              <p className="mt-2 text-2xl font-semibold text-white">{mathsStmgQuestionModule.questions.length}</p>
              <p className="text-sm text-neutral-400">questions corrigées</p>
            </CardContent>
          </Card>
        </section>

        <section id="programme" className="scroll-mt-24 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Target className="h-5 w-5 text-brand-accent" aria-hidden="true" />
              Skill graph Maths STMG
            </h2>
            <p className="text-sm text-neutral-400">Domaines et compétences réellement présents dans le dépôt Nexus.</p>
          </div>
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
        </section>

        <section id="qcm" className="scroll-mt-24 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <ClipboardList className="h-5 w-5 text-brand-accent" aria-hidden="true" />
              Banque QCM Maths STMG
            </h2>
            <p className="text-sm text-neutral-400">
              {mathsStmgQuestionModule.questions.length} questions existantes, groupées par domaine, avec correction et explication.
            </p>
          </div>

          <div className="space-y-4">
            {groupedQuestions.map(([category, questions]) => (
              <Card key={category} className="border-white/10 bg-surface-card">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base text-white">
                    {category}
                    <Badge variant="outline">{questions.length} questions</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {questions.map((question) => {
                      const correctAnswer = question.options.find((option) => option.isCorrect)?.text ?? '';
                      return (
                        <li key={question.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Niveau {question.weight}</Badge>
                            {question.competencies.slice(0, 2).map((competency) => (
                              <Badge key={competency} variant="outline" className="font-mono text-[10px]">
                                {competency}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-3 text-sm font-medium text-neutral-100">{question.questionText}</p>
                          <p className="mt-2 text-sm text-emerald-300">Réponse : {correctAnswer}</p>
                          <p className="mt-1 text-xs text-neutral-400">{question.explanation}</p>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Autres ressources Première STMG</h2>
            <p className="text-sm text-neutral-400">Modules STMG détectés dans le dépôt et attachés au dashboard.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {STMG_LINKED_MODULES.map((resource) => (
              <Card key={resource.href} className="border-white/10 bg-surface-card">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{resource.title}</h3>
                    <p className="mt-1 text-xs text-neutral-400">{resource.description}</p>
                  </div>
                  <Link href={resource.href} className="shrink-0 text-brand-accent hover:text-white" aria-label={`Ouvrir ${resource.title}`}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
