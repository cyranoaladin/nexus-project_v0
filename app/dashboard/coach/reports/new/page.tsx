export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function NewReportPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'COACH') return null;

  async function createReport(formData: FormData) {
    'use server';
    const s = await getServerSession(authOptions);
    if (!s || s.user.role !== 'COACH') return;
    const coach = await prisma.coachProfile.findUnique({ where: { userId: s.user.id } });
    if (!coach) return;

    const studentId = String(formData.get('studentId'));
    const title = String(formData.get('title'));
    const period = String(formData.get('period'));
    const content = String(formData.get('content'));

    await prisma.studentReport.create({
      data: {
        coachId: coach.id,
        studentId,
        title,
        period,
        content,
      },
    });
    redirect('/dashboard/coach/reports');
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: { sessions: { include: { student: { include: { user: true } } }, take: 20 } },
  });

  const students = Array.from(new Map(
    (coach?.sessions || []).map(s => [s.studentId, s.student])
  ).values());

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Nouveau rapport</h1>
      <form action={createReport} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Élève</label>
          <select name="studentId" className="w-full border rounded-md p-2" required>
            {students.map((st: any) => (
              <option key={st.id} value={st.id}>
                {st.user.firstName} {st.user.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Titre</label>
          <input name="title" className="w-full border rounded-md p-2" placeholder="Ex: Bilan hebdomadaire" required />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Période</label>
          <input name="period" className="w-full border rounded-md p-2" placeholder="Semaine du 10 au 16" required />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Contenu</label>
          <textarea name="content" className="w-full border rounded-md p-2 h-40" placeholder="Notes de progression, recommandations..." required />
        </div>

        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Enregistrer</button>
      </form>
    </div>
  );
}


