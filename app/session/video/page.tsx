"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoConference } from "@/components/ui/video-conference";
import { ArrowLeft, BookOpen, Clock, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface SessionData {
  id: string;
  studentName: string;
  coachName: string;
  subject: string;
  scheduledAt: string;
  duration: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

type SessionJoinResponse = {
  success: boolean;
  error?: string;
  sessionData?: SessionData & {
    roomName: string;
    isHost?: boolean;
  };
};

function SessionVideoCallContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    if (!sessionId) {
      setError("ID de session manquant");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sessions/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'JOIN' })
        });
        const data: SessionJoinResponse = await response.json();
        if (!response.ok || !data.success || !data.sessionData) {
          throw new Error(data.error || 'Impossible de rejoindre la session');
        }
        const s = data.sessionData;
        setSessionData({
          id: s.id,
          studentName: s.studentName,
          coachName: s.coachName,
          subject: s.subject,
          scheduledAt: s.scheduledAt,
          duration: s.duration,
          status: s.status,
        });
        setRoomName(s.roomName);
        setIsHost(!!s.isHost);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Erreur lors de la jonction à la session';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, status, router, sessionId]);

  const handleLeaveSession = async () => {
    try {
      await fetch('/api/sessions/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'LEAVE' })
      });
    } catch {}
    const redirectPath = session?.user.role === 'ELEVE'
      ? '/dashboard/eleve'
      : session?.user.role === 'COACH'
        ? '/dashboard/coach'
        : '/dashboard';

    router.push(redirectPath);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              {error || "Session introuvable"}
            </p>
            <Button asChild>
              <Link href={session?.user.role === 'ELEVE' ? '/dashboard/eleve' : '/dashboard'}>
                Retour au tableau de bord
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // roomName and isHost are controlled by API response above

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href={session?.user.role === 'ELEVE' ? '/dashboard/eleve' : '/dashboard'}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Link>
              </Button>
              <div>
                <h1 className="font-semibold text-gray-900">
                  Session de Visioconférence
                </h1>
                <p className="text-sm text-gray-500">
                  {sessionData.subject}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {sessionData.duration} min
              </Badge>
              <Badge
                variant={sessionData.status === 'IN_PROGRESS' ? 'default' : 'outline'}
                className={sessionData.status === 'IN_PROGRESS' ? 'bg-green-500' : ''}
              >
                {sessionData.status === 'IN_PROGRESS' && 'En cours'}
                {sessionData.status === 'SCHEDULED' && 'Planifiée'}
                {sessionData.status === 'COMPLETED' && 'Terminée'}
                {sessionData.status === 'CANCELLED' && 'Annulée'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Info */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Coach</p>
                    <p className="text-sm text-gray-500">{sessionData.coachName}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Élève</p>
                    <p className="text-sm text-gray-500">{sessionData.studentName}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Matière</p>
                    <p className="text-sm text-gray-500">{sessionData.subject}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Conference */}
        {roomName && (
          <VideoConference
            sessionId={sessionData.id}
            studentName={sessionData.studentName}
            coachName={sessionData.coachName}
            roomName={roomName}
            isHost={isHost}
            onLeave={handleLeaveSession}
          />
        )}

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Pour une meilleure qualité :</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Utilisez une connexion internet stable</li>
                  <li>• Assurez-vous d'avoir un bon éclairage</li>
                  <li>• Portez des écouteurs pour éviter l'écho</li>
                  <li>• Fermez les autres applications</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Contrôles disponibles :</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Activer/désactiver le microphone</li>
                  <li>• Activer/désactiver la caméra</li>
                  <li>• Utiliser le chat textuel</li>
                  <li>• Partager l'écran {isHost && '(Coach uniquement)'}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function SessionVideoCall() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SessionVideoCallContent />
    </Suspense>
  );
}
