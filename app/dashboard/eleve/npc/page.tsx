// ═══════════════════════════════════════════════════════════════════════════════
// NPC Dashboard - Student View
// Simple interface for students to view their diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { StudentReportList } from '@/components/npc/student/StudentReportList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CheckCircle, Clock, GraduationCap } from 'lucide-react';

export const metadata = {
  title: 'NPC - Mes Diagnostics',
  description: 'Consultez vos analyses pédagogiques',
};

export default async function StudentNpcPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ELEVE') {
    redirect('/auth/login');
  }

  // Fetch student profile
  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
  });

  if (!student) {
    redirect('/dashboard');
  }

  // Fetch student's submissions with reports
  const submissions = await prisma.copySubmission.findMany({
    where: { studentId: student.id },
    include: {
      report: true,
      coach: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Filter submissions with completed reports
  const submissionsWithReports = submissions.filter((s: typeof submissions[0]) => s.report && s.status === 'COMPLETED');
  const pendingSubmissions = submissions.filter(
    (s: typeof submissions[0]) => !s.report || s.status !== 'COMPLETED'
  );

  // Calculate stats
  const totalReports = submissionsWithReports.length;
  const subjects = [...new Set(submissionsWithReports.map((s: typeof submissions[0]) => s.subject))];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">Mes Diagnostics</h1>
        </div>
        <p className="text-gray-600 mt-2">
          Consultez les analyses de vos copies et suivez vos progrès
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Diagnostics reçus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Matières couvertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{subjects.length}</div>
            <div className="text-xs text-gray-500 mt-1">
              {subjects.join(', ')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{pendingSubmissions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="reports">
            Mes diagnostics
            <Badge variant="outline" className="ml-2">{totalReports}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            En cours
            <Badge variant="outline" className="ml-2">{pendingSubmissions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {submissionsWithReports.length > 0 ? (
            <StudentReportList submissions={submissionsWithReports} />
          ) : (
            <Card className="p-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun diagnostic pour le moment</p>
              <p className="text-sm text-gray-400 mt-1">
                Votre coach vous enverra une analyse bientôt
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingSubmissions.length > 0 ? (
            <StudentReportList submissions={pendingSubmissions} showStatus />
          ) : (
            <Card className="p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-300 mb-4" />
              <p className="text-gray-500">Toutes vos copies ont été analysées !</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
