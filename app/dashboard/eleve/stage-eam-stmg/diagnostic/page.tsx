import { StageEamStmgDiagnostic } from "@/components/stage-eam-stmg/StageEamStmgClient";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Diagnostic EAM STMG | Nexus Réussite",
};

export default async function StageEamStmgDiagnosticPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/dashboard/eleve/stage-eam-stmg/diagnostic");
  if (session.user.role !== UserRole.ELEVE) redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!student) redirect("/dashboard/eleve");

  return <StageEamStmgDiagnostic eleveId={student.id} />;
}
