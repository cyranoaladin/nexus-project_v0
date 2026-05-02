// ═══════════════════════════════════════════════════════════════════════════════
// NPC Dashboard - Parent View
// Overview of all children's diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ParentReportList } from '@/components/npc/parent/ParentReportList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, BookOpen, CheckCircle, Clock, GraduationCap } from 'lucide-react';

export const metadata = {
  title: 'NPC - Diagnostics de mes enfants',
  description: 'Suivez les analyses pédagogiques de vos enfants',
};

export default async function ParentNpcPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/auth/login');
  }

  // Fetch parent profile with children
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      children: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!parent || parent.children.length === 0) {
    redirect('/dashboard/parent');
  }

  // Get all children IDs
  const childrenIds = parent.children.map((student: typeof parent.children[0]) => student.id);

  // Fetch all submissions for all children
  const submissions = await prisma.copySubmission.findMany({
    where: {
      studentId: { in: childrenIds },
    },
    include: {
      student: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
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
    take: 100,
  });

  // Group by child
  const submissionsByChild = parent.children.map((child: typeof parent.children[0]) => {
    const childSubmissions = submissions.filter(
      (s: typeof submissions[0]) => s.studentId === child.id
    );
    return {
      child,
      submissions: childSubmissions,
      completedCount: childSubmissions.filter(
        (s: typeof submissions[0]) => s.report && s.status === 'COMPLETED'
      ).length,
      pendingCount: childSubmissions.filter(
        (s: typeof submissions[0]) => !s.report || s.status !== 'COMPLETED'
      ).length,
    };
  });

  // Calculate totals
  const totalCompleted = submissionsByChild.reduce(
    (sum: number, c: typeof submissionsByChild[0]) => sum + c.completedCount,
    0
  );
  const totalPending = submissionsByChild.reduce(
    (sum: number, c: typeof submissionsByChild[0]) => sum + c.pendingCount,
    0
  );
  const allSubjects = [
    ...new Set(submissions.map((s: typeof submissions[0]) => s.subject)),
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Diagnostics de mes enfants
          </h1>
        </div>
        <p className="text-gray-600 mt-2">
          Suivez les analyses pédagogiques et les progrès de vos enfants
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Diagnostics reçus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {totalCompleted}
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
            <div className="text-3xl font-bold text-gray-900">
              {totalPending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Matières
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {allSubjects.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Enfants suivis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {parent.children.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Children Sections */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">
            Tous les enfants
            <Badge variant="outline" className="ml-2">
              {submissions.length}
            </Badge>
          </TabsTrigger>
          {submissionsByChild.map((childData: typeof submissionsByChild[0]) => (
            <TabsTrigger key={childData.child.id} value={childData.child.id}>
              {childData.child.user.firstName}
              <Badge variant="outline" className="ml-2">
                {childData.submissions.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-8">
          {submissionsByChild.map((childData: typeof submissionsByChild[0]) => (
            <div key={childData.child.id}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                {childData.child.user.firstName} {childData.child.user.lastName}
                <Badge className="bg-green-100 text-green-800">
                  {childData.completedCount} diagnostics
                </Badge>
              </h2>
              <ParentReportList submissions={childData.submissions} />
            </div>
          ))}
        </TabsContent>

        {submissionsByChild.map((childData: typeof submissionsByChild[0]) => (
          <TabsContent key={childData.child.id} value={childData.child.id}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {childData.child.user.firstName} {childData.child.user.lastName}
              </h2>
              <p className="text-sm text-gray-500">
                {childData.completedCount} diagnostics reçus •{' '}
                {childData.pendingCount} en cours
              </p>
            </div>
            <ParentReportList submissions={childData.submissions} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
