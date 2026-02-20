"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Calendar, Clock, User, Video } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Session {
  id: string;
  studentName: string;
  coachName: string;
  subject: string;
  scheduledAt: string;
  duration: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  canJoin: boolean;
}

export default function MesSessions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/student/sessions');
        
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        
        type ApiSession = {
          id: string;
          coach: { firstName?: string; lastName?: string };
          title: string;
          scheduledAt: string;
          duration: number;
          status: Session['status'];
        };

        const data = (await response.json()) as ApiSession[];
        
        // Transform API data to match Session interface
        const transformedSessions: Session[] = data.map((sessionData) => ({
          id: sessionData.id,
          studentName: `${session?.user.firstName} ${session?.user.lastName}`,
          coachName: `${sessionData.coach.firstName} ${sessionData.coach.lastName}`,
          subject: sessionData.title,
          scheduledAt: sessionData.scheduledAt,
          duration: sessionData.duration,
          status: sessionData.status,
          canJoin: sessionData.status === 'SCHEDULED' && 
                   new Date(sessionData.scheduledAt) <= new Date(Date.now() + 15 * 60 * 1000) // Within 15 minutes
        }));
        
        setSessions(transformedSessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [session, status, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

    if (isToday) {
      return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isTomorrow) {
      return `Demain à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-200">Programmée</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="border border-emerald-500/40 bg-emerald-500/20 text-emerald-200">En cours</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="border-white/10 bg-white/5 text-neutral-300">Terminée</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-200">Annulée</Badge>;
      default:
        return <Badge variant="outline">Inconnue</Badge>;
    }
  };

  const canJoinSession = (session: Session) => {
    const sessionTime = new Date(session.scheduledAt);
    const now = new Date();
    const timeDifference = sessionTime.getTime() - now.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    return (
      session.status === 'SCHEDULED' &&
      timeDifference <= fifteenMinutes &&
      timeDifference >= -fifteenMinutes
    );
  };

  const handleJoinSession = (sessionId: string) => {
    router.push(`/session/video?sessionId=${sessionId}`);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <p className="text-neutral-300">Chargement de vos sessions...</p>
        </div>
      </div>
    );
  }

  const upcomingSessions = sessions.filter(s => s.status === 'SCHEDULED');
  const completedSessions = sessions.filter(s => s.status === 'COMPLETED');

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 text-rose-300">⚠️</div>
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="bg-surface-card/80 shadow-sm border-b border-white/10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/eleve">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Link>
              </Button>
              <div>
                <h1 className="font-semibold text-white">Mes Sessions</h1>
                <p className="text-sm text-neutral-400">Gérez vos cours de soutien</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/dashboard/eleve/sessions">
                Réserver une session
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sessions à venir */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Sessions programmées</h2>

          {upcomingSessions.length === 0 ? (
            <Card className="bg-white/5 border border-white/10">
              <CardContent className="text-center py-8">
                <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <p className="text-neutral-300 mb-4">Aucune session programmée</p>
                <Button asChild>
                  <Link href="/dashboard/eleve/sessions">
                    Réserver une session
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingSessions.map((sessionItem) => (
                <Card key={sessionItem.id} className="bg-white/5 border border-white/10 hover:border-brand-accent/50 hover:shadow-premium transition">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-brand-accent" />
                        {sessionItem.subject}
                      </CardTitle>
                      {getStatusBadge(sessionItem.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-neutral-300">
                        <User className="w-4 h-4 mr-2" />
                        {sessionItem.coachName}
                      </div>

                      <div className="flex items-center text-sm text-neutral-300">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatDate(sessionItem.scheduledAt)}
                      </div>

                      <div className="flex items-center text-sm text-neutral-300">
                        <Clock className="w-4 h-4 mr-2" />
                        {sessionItem.duration} minutes
                      </div>

                      {canJoinSession(sessionItem) ? (
                        <Button
                          className="w-full mt-4"
                          onClick={() => handleJoinSession(sessionItem.id)}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Rejoindre la session
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full mt-4 border-white/10 bg-white/5 text-neutral-200"
                          disabled
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Pas encore disponible
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Historique des sessions */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Historique</h2>

          {completedSessions.length === 0 ? (
            <Card className="bg-white/5 border border-white/10">
              <CardContent className="text-center py-8">
                <BookOpen className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <p className="text-neutral-300">Aucune session terminée</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedSessions.map((sessionItem) => (
                <Card key={sessionItem.id} className="bg-white/5 border border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <BookOpen className="w-8 h-8 text-neutral-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{sessionItem.subject}</h3>
                          <p className="text-sm text-neutral-400">avec {sessionItem.coachName}</p>
                          <p className="text-sm text-neutral-400">{formatDate(sessionItem.scheduledAt)} • {sessionItem.duration} min</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(sessionItem.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
