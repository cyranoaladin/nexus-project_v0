"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import EAMPrep from "@/components/EAMPrep";
import { Button } from "@/components/ui/button";

export default function EAMDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ELEVE") {
      router.push("/auth/signin?callbackUrl=/dashboard/eleve/eam");
    }
  }, [router, session, status]);

  if (status === "loading" || !session || session.user.role !== "ELEVE") {
    return (
      <main className="min-h-screen bg-surface-darker text-neutral-100">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-accent" aria-label="Chargement" />
            <p className="text-sm text-neutral-400">Chargement du module EAM...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-surface-darker text-neutral-100">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
          <Link href="/dashboard/eleve" className="min-w-0">
            <Button variant="ghost" className="max-w-full text-neutral-300 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Retour au dashboard</span>
            </Button>
          </Link>
        </div>
        <EAMPrep />
      </div>
    </main>
  );
}
