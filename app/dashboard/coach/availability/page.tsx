"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import CoachAvailability from "@/components/ui/coach-availability";
import { Loader2 } from "lucide-react";

export default function CoachAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin");
    }
  }, [session, status, router]);

  if (status === "loading" || !session?.user?.id) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Mes Disponibilités</h1>
      <CoachAvailability coachId={session.user.id} />
    </div>
  );
}
