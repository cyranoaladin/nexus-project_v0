"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, AlertCircle, FileText, CheckCircle } from "lucide-react";
import { SessionReportDialog } from "@/components/ui/session-report-dialog";

interface Session {
  id: string;
  studentName: string;
  subject: string;
  time: string;
  type: string;
  status: string;
  scheduledAt: string;
  duration: number;
}

interface WeekSession {
  id: string;
  title: string;
  subject: string;
  type: string;
  modality: string;
  studentName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  description: string;
  status: string;
  creditsUsed: number;
}

export default function CoachSessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [weekSessions, setWeekSessions] = useState<WeekSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/coach/dashboard');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setTodaySessions(data.todaySessions || []);
      setWeekSessions(data.weekSessions || []);
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
      <h1 className="text-2xl font-bold text-white mb-6">Mes Sessions</h1>

      {/* Today's Sessions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-brand-accent" />
            Sessions d&apos;aujourd&apos;hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySessions.length > 0 ? (
            <div className="space-y-4">
              {todaySessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{s.studentName}</h4>
                      <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">{s.type}</Badge>
                      {s.status === 'COMPLETED' && (
                        <Badge className="text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3 mr-1" />Terminée
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-300">{s.subject}</p>
                    <p className="text-sm font-medium text-brand-accent">{s.time}</p>
                  </div>
                  {(s.status === 'CONFIRMED' || s.status === 'IN_PROGRESS') && (
                    <SessionReportDialog
                      sessionId={s.id}
                      onReportSubmitted={fetchData}
                      trigger={
                        <Button size="sm"><FileText className="w-4 h-4 mr-2" />Rapport</Button>
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-400 text-center py-8">Aucune session prévue aujourd&apos;hui.</p>
          )}
        </CardContent>
      </Card>

      {/* Week Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-brand-accent" />
            Sessions de la semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weekSessions.length > 0 ? (
            <div className="space-y-3">
              {weekSessions.map((ws) => (
                <div key={ws.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{ws.studentName}</span>
                      <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">{ws.subject}</Badge>
                    </div>
                    <p className="text-sm text-neutral-400">{ws.date} · {ws.startTime} - {ws.endTime}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">{ws.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-400 text-center py-8">Aucune session cette semaine.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
