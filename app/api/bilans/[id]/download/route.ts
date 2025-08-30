import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bilanId = params.id;

    if (!bilanId) {
      return NextResponse.json({ error: "Bilan ID is required" }, { status: 400 });
    }

    const bilan = await prisma.bilanPremium.findUnique({
      where: { id: bilanId },
    });

    if (!bilan) {
      return NextResponse.json({ error: "Bilan not found" }, { status: 404 });
    }

    // ACL Checks
    const { user } = session;
    if (user.role === UserRole.ELEVE && bilan.studentId !== user.studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role === UserRole.PARENT) {
       const parent = await prisma.parentProfile.findUnique({
        where: { userId: user.id },
        include: { children: { select: { id: true } } },
      });
      if (!parent || !parent.children.some(child => child.id === bilan.studentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }


    if (bilan.status !== 'READY' || !bilan.pdfUrl) {
      return NextResponse.json({ error: "PDF is not ready or URL is missing" }, { status: 409 });
    }

    // Pour le stockage local, nous servons le fichier directement.
    // Le pdfUrl est `/files/studentId/variant/bilan.pdf`
    // Il faut le transformer en chemin de fichier local.
    const filePath = path.join(process.cwd(), 'storage/reports', bilan.pdfUrl.replace('/files/', ''));

    try {
      const stats = await fs.stat(filePath);
      const data = await fs.readFile(filePath);

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': stats.size.toString(),
          'Content-Disposition': `attachment; filename="bilan_${bilanId}.pdf"`,
        },
      });
    } catch (error) {
       console.error("File not found:", filePath, error);
       return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

  } catch (error) {
    console.error("Failed to download bilan:", error);
    return NextResponse.json({ error: "Failed to download bilan" }, { status: 500 });
  }
}
