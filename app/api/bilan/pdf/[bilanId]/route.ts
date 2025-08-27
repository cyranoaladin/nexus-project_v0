import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { bilanId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bilan = await prisma.bilan.findUnique({ where: { id: params.bilanId }, include: { student: { include: { user: true, parent: { include: { user: true } } } } } });
  if (!bilan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = (session.user as any).role;
  const isOwner = bilan.student.userId === session.user.id;
  const isParent = bilan.student.parent?.userId === session.user.id;
  const isAdmin = role === "ADMIN";
  if (!(isOwner || isParent || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!bilan.pdfBlob) return NextResponse.json({ error: "No PDF available" }, { status: 404 });

  return new NextResponse(bilan.pdfBlob as unknown as Buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=bilan-${bilan.id}.pdf`,
    }
  });
}

