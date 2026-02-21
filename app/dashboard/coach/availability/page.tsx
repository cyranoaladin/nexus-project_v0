"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import CoachAvailability from "@/components/ui/coach-availability";
import { Loader2 } from "lucide-react";

export default function CoachAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coachId, setCoachId] = useState<string | null>(null);

  const fetchCoachId = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/dashboard');
      if (!response.ok) return;
      const data = await response.json();
      setCoachId(data.coach?.id || session?.user?.id || null);
    } catch {
      setCoachId(session?.user?.id || null);
    }
  }, [session]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin");
      return;
    }
    fetchCoachId();
  }, [session, status, router, fetchCoachId]);

  if (status === "loading" || !coachId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Mes Disponibilités</h1>
      <CoachAvailability coachId={coachId} />
    </div>
  );
}
