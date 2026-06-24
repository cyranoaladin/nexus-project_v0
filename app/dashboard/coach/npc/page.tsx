// ═══════════════════════════════════════════════════════════════════════════════
// NPC Dashboard - Coach View
// Main interface for coaches to manage copy submissions and reports
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CopySubmissionList } from '@/components/npc/coach/CopySubmissionList';
import { CreateSubmissionButton } from '@/components/npc/coach/CreateSubmissionButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'NPC - Mes Copies',
  description: 'Gestion des copies et diagnostics pédagogiques',
};

export default async function CoachNpcPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'COACH') {
    redirect('/auth/signin');
  }

  // Fetch coach profile
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!coach) {
    redirect('/dashboard');
  }

  // Fetch assigned students
  const assignedStudents = await prisma.coachStudentAssignment.findMany({
    where: { coachId: coach.id },
    include: {
      student: {
        include: { user: true },
      },
    },
  });

  // Fetch recent submissions
  const submissions = await prisma.copySubmission.findMany({
    where: {
      OR: [
        { coachId: coach.id },
        { studentId: { in: assignedStudents.map((a: typeof assignedStudents[0]) => a.studentId) } },
      ],
    },
    include: {
      student: {
        include: { user: true },
      },
      report: true,
      aiJob: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const pendingSubmissions = submissions.filter(
    (s: typeof submissions[0]) => s.status === 'PENDING_UPLOAD' || s.status === 'UPLOADED'
  );
  const processingSubmissions = submissions.filter(
    (s: typeof submissions[0]) => s.status === 'PROCESSING_OCR' || s.status === 'ANALYZING' || s.status === 'QUEUED_FOR_ANALYSIS'
  );
  const completedSubmissions = submissions.filter(
    (s: typeof submissions[0]) => s.status === 'COMPLETED'
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nexus Pédagogie</h1>
          <p className="text-gray-600 mt-1">
            Gérez les copies de vos élèves et consultez les diagnostics IA
          </p>
        </div>
        <CreateSubmissionButton students={assignedStudents.map((a: typeof assignedStudents[0]) => ({
          id: a.student.id,
          name: a.student.user.firstName && a.student.user.lastName ? `${a.student.user.firstName} ${a.student.user.lastName}` : 'Élève',
        }))} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Copies en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSubmissions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              En analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingSubmissions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Diagnostics prêts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedSubmissions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Élèves suivis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedStudents.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            Toutes
            <Badge variant="outline" className="ml-2">{submissions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            En attente
            <Badge variant="outline" className="ml-2">{pendingSubmissions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="processing">
            En cours
            <Badge variant="outline" className="ml-2">{processingSubmissions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Terminées
            <Badge variant="outline" className="ml-2">{completedSubmissions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CopySubmissionList submissions={submissions} />
        </TabsContent>
        <TabsContent value="pending">
          <CopySubmissionList submissions={pendingSubmissions} />
        </TabsContent>
        <TabsContent value="processing">
          <CopySubmissionList submissions={processingSubmissions} />
        </TabsContent>
        <TabsContent value="completed">
          <CopySubmissionList submissions={completedSubmissions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
