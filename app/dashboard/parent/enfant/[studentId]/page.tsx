"use client";

import { ParentCanonicalReports } from "@/components/bilans/ParentCanonicalReports";
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";
import type { ParentDashboardChild } from "@/components/dashboard/parent/ChildCard";
import { ProgressEvolutionChart } from "@/components/dashboard/parent/ProgressEvolutionChart";
import { AriaMasteryCard } from "@/components/dashboard/parent/AriaMasteryCard";
import { AriaBilansCard } from "@/components/dashboard/parent/AriaBilansCard";
import { AriaWorkshopsCard } from "@/components/dashboard/parent/AriaWorkshopsCard";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ArrowLeft,Calendar,Loader2,MessageCircle,Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams,useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { CanonicalConsentCard } from "./canonical-consent-card";

export default function ChildDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;
  
  const [childData, setChildData] = useState<ParentDashboardChild | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsRefreshSignal, setReportsRefreshSignal] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    const fetchChildData = async () => {
      try {
        const response = await fetch('/api/parent/dashboard');
        const data = await response.json() as { children: ParentDashboardChild[] };
        const child = data.children.find((candidate) => candidate.id === studentId);
        if (child) {
          setChildData(child);
        } else {
          router.push("/dashboard/parent");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchChildData();
    }
  }, [status, studentId, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (!childData) return null;

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white" asChild>
          <Link href="/dashboard/parent">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la famille
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              {childData.firstName} {childData.lastName}
            </h1>
            <p className="text-neutral-400">
              {childData.gradeLevel} • {childData.academicTrack.replace('_', ' ')}
            </p>
          </div>

        </div>

        <DashboardPilotage role="PARENT" studentId={studentId}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ParentCanonicalReports studentId={studentId} refreshSignal={reportsRefreshSignal} />

              <AriaMasteryCard studentId={studentId} />

              <AriaBilansCard studentId={studentId} />

              <AriaWorkshopsCard studentId={studentId} />

              <ProgressEvolutionChart data={childData.progressionHistory ?? []} />
            </div>

            <div className="space-y-8">
              <CanonicalConsentCard
                studentId={studentId}
                onVerified={() => setReportsRefreshSignal((current) => current + 1)}
              />

              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-accent" />
                    Prochaines Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(childData.sessions ?? []).map((session) => (
                    <div key={session.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white">
                          {session.courseLabel ?? session.subject}
                        </p>
                        {session.planningSeriesId && (
                          <span className="shrink-0 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-accent">
                            Série
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        {/* scheduledAt/endAt are a "pseudo-UTC" encoding (lib/planning/invariants.ts
                            combineDateAndTime): the Tunis wall-clock hour/minute are written
                            directly into the UTC accessors of the ISO string. `timeZone: 'UTC'`
                            reads those digits back as-is instead of re-converting through the
                            browser's real local timezone, which would silently shift every time
                            shown to a real Tunis-based parent by the local UTC offset. */}
                        {new Date(session.scheduledAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          timeZone: 'UTC',
                        })}{' '}
                        {new Date(session.scheduledAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        })}
                        {session.endAt &&
                          ` – ${new Date(session.endAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          })}`}
                        {' • '}
                        {session.coachName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {session.modality === 'ONLINE' ? 'En ligne' : session.modality === 'IN_PERSON' ? 'Présentiel' : session.modality}
                        {session.location ? ` • ${session.location}` : ''}
                      </p>
                    </div>
                  ))}
                  {(childData.sessions ?? []).length === 0 && (
                    <p className="text-sm text-neutral-400">Aucune séance programmée pour le moment.</p>
                  )}
                  <Button asChild variant="outline" className="w-full border-white/10">
                    <a
                      href={buildWhatsAppUrl(
                        `le planning de ${childData.firstName}`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Demander un créneau
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Abonnement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 uppercase font-bold">Formule</p>
                    <p className="text-lg font-bold text-white">{childData.subscription ?? 'Aucune formule active'}</p>
                  </div>
                  <Button asChild variant="outline" className="w-full border-white/10">
                    <Link href="/dashboard/parent/abonnements">
                      Voir les formules
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </DashboardPilotage>
      </div>
    </div>
  );
}
