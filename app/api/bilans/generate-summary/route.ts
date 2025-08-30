import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/authz";
import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { openai } from "@/server/openai/client";
import { buildMessages } from "@/server/openai/promptBuilders";
import { AdminSummarySchema } from "@/server/bilan/schema";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requireRole([UserRole.ADMIN, UserRole.ASSISTANTE], session);

    const body = await req.json();
    const { studentId, qcm, volet2 } = body; // Données factices pour l'instant

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const client = openai();
    const messages = buildMessages({
      variant: 'admin',
      student: {
        name: `${student.firstName} ${student.lastName}`,
        level: student.grade || 'N/A',
        subjects: 'N/A',
        status: 'Scolarisé',
      },
      qcm,
      volet2,
      outSchema: AdminSummarySchema,
    });
    
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: messages as any,
      response_format: { type: "json_object" },
    });

    const raw = resp.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const summary = AdminSummarySchema.parse(parsed);

    return NextResponse.json(summary);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Failed to generate admin summary:", error);
    return NextResponse.json({ error: "Failed to generate summary", details: errorMessage }, { status: 500 });
  }
}



