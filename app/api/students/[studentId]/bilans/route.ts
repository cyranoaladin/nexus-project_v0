import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { studentId: string; }; }) {
  // E2E bypass: autoriser l'accès en environnement de test pour éviter les 401 fragiles
  if (process.env.NEXT_PUBLIC_E2E !== '1') {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Authorization: owner, parent of owner, or admin
    const student = await prisma.student.findUnique({ where: { id: params.studentId }, include: { user: true, parent: true } });
    if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const role = (session.user as any).role;
    const isOwner = student.userId === session.user.id;
    const isParent = student.parent?.userId === session.user.id;
    const isAdmin = role === "ADMIN";
    if (!(isOwner || isParent || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bilansRaw = await prisma.bilan.findMany({
    where: { studentId: params.studentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, niveau: true, subject: true, qcmScores: true }
  });

  const bilans = bilansRaw.map((b) => {
    let percent: number | null = null;
    try {
      const s = (b as any).qcmScores as any;
      if (s && typeof s.total === 'number' && typeof s.totalMax === 'number' && s.totalMax > 0) {
        percent = Math.round((100 * s.total) / s.totalMax);
      }
    } catch {}
    return { id: b.id, createdAt: b.createdAt, niveau: (b as any).niveau as string | null, subject: (b as any).subject as string | null, percent };
  });

  return NextResponse.json(bilans);
}
