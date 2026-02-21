"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Loader2, AlertCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  grade: string;
  subject: string;
  lastSession: string;
  creditBalance: number;
  isNew: boolean;
}

export default function CoachStudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/coach/dashboard');
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      setStudents(data.students || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin");
      return;
    }
    fetchData();
  }, [session, status, router, fetchData]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-2">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm mb-4">{error}</p>
          <Button onClick={fetchData} className="btn-primary">Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Mes Étudiants</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2 text-brand-accent" />
            Étudiants suivis ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length > 0 ? (
            <div className="space-y-3">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{s.name}</h4>
                      {s.isNew && (
                        <Badge className="text-xs bg-brand-accent/15 text-brand-accent border border-brand-accent/20">Nouveau</Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-400">{s.grade} · {s.subject}</p>
                    <p className="text-xs text-neutral-500">Dernière session : {s.lastSession || 'Aucune'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`font-medium ${s.creditBalance > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {s.creditBalance} crédits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-400 text-center py-8">Aucun étudiant assigné pour le moment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
