import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { studentId: string } }) {
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

  const bilans = await prisma.bilan.findMany({
    where: { studentId: params.studentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true }
  });

  return NextResponse.json(bilans);
}
