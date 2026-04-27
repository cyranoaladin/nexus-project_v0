import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowLeft } from "lucide-react";

export default async function AutomatismesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: UserRole }
    | undefined;

  if (!user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/eleve/automatismes");
  }

  if (user.role !== UserRole.ELEVE) {
    redirect("/dashboard");
  }

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { academicTrack: true },
  });

  const isStmg =
    student?.academicTrack === "STMG" ||
    student?.academicTrack === "STMG_NON_LYCEEN";

  if (isStmg) {
    return (
      <div className="min-h-screen bg-surface-darker text-neutral-100 flex items-center justify-center p-8">
        <Card className="max-w-lg w-full bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <BookOpen className="w-6 h-6 text-brand-accent" />
              Parcours STMG
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-neutral-300 text-sm leading-relaxed">
              Les <strong className="text-white">Automatismes EDS</strong> sont
              conçus pour les élèves de Première générale avec spécialité
              mathématiques.
            </p>
            <p className="text-neutral-400 text-sm">
              En tant qu&apos;élève de <strong className="text-brand-accent">Première STMG</strong>,
              votre parcours mathématiques est accessible via vos modules STMG
              et le Livret Gamifié.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/dashboard/eleve" className="flex-1">
                <Button className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold">
                  Mon tableau de bord STMG
                </Button>
              </Link>
              <Link href="/dashboard/eleve/programme/maths" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-neutral-300 hover:text-white hover:bg-white/5"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Maths STMG
                </Button>
              </Link>
            </div>
            <Link
              href="/dashboard/eleve"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 mt-2"
            >
              <ArrowLeft className="w-3 h-3" />
              Retour au dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
