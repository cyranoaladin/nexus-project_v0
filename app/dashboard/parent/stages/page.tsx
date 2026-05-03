'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Loader2,
  GraduationCap,
  Calendar,
  FileText,
  ArrowLeft,
  AlertCircle,
  BookOpen,
  Calculator,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BilanParentPreview from '@/components/bilan/BilanParentPreview';

type CoachBilan = {
  id: string;
  type: string;
  subject: string;
  studentId: string;
  studentName: string;
  globalScore: number | null;
  domainScores: unknown;
  parentsMarkdown: string | null;
  publishedAt: string | null;
  createdAt: string;
  stage: { title: string; slug: string } | null;
  coach: { pseudonym: string | null } | null;
  student: { user: { firstName: string | null; lastName: string | null } | null } | null;
};

type StageBilanLegacy = {
  id: string;
  stageId: string;
  studentId: string;
  contentParent: string | null;
  scoreGlobal: number | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  stage: { title: string; slug: string } | null;
  student: { user: { firstName: string | null; lastName: string | null } | null } | null;
};

type Reservation = {
  id: string;
  stage: { title: string; slug: string; sessions: Array<{ startAt: string }> } | null;
};

type ApiResponse = {
  reservations: Reservation[];
  bilans: StageBilanLegacy[];
  coachBilans: CoachBilan[];
};

const SUBJECT_META: Record<string, { label: string; icon: typeof Calculator; color: string }> = {
  MATHEMATIQUES: { label: 'Mathématiques', icon: Calculator, color: 'text-indigo-400' },
  FRANCAIS: { label: 'Français / EAF', icon: BookOpen, color: 'text-rose-400' },
};

export default function ParentStagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBilanId, setExpandedBilanId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'PARENT') {
      router.push('/auth/signin');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/parent/stages');
        if (!res.ok) throw new Error('Impossible de charger les stages et bilans.');
        const json = (await res.json()) as ApiResponse;
        setData(json);
        // Auto-expand if only one bilan
        const allBilans = [...(json.coachBilans ?? []), ...(json.bilans ?? [])];
        if (allBilans.length === 1) {
          setExpandedBilanId(allBilans[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur réseau.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">{error}</p>
          <Link href="/dashboard/parent">
            <Button variant="outline" className="border-white/10">Retour au dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const coachBilans = data?.coachBilans ?? [];
  const legacyBilans = data?.bilans ?? [];
  const reservations = data?.reservations ?? [];
  const hasAnyContent = coachBilans.length > 0 || legacyBilans.length > 0 || reservations.length > 0;

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard/parent">
          <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <GraduationCap className="w-8 h-8 text-brand-accent" />
          <div>
            <h1 className="text-2xl font-bold text-white">Stages & Bilans</h1>
            <p className="text-sm text-neutral-400">
              Retrouvez les bilans pédagogiques rédigés par les coachs et les stages à venir.
            </p>
          </div>
        </div>

        {!hasAnyContent && (
          <Card className="bg-surface-card border border-white/10">
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-neutral-500" />
              <p className="text-neutral-300 mb-2">Aucun stage ni bilan disponible pour le moment.</p>
              <p className="text-sm text-neutral-500">
                Les bilans apparaîtront ici dès qu'un coach aura publié le rapport de stage de votre enfant.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Coach Bilans — unified Bilan model (maths premiere + EAF) */}
        {coachBilans.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-accent" />
              Bilans de stage
              <Badge variant="outline" className="ml-1 border-white/10 text-neutral-400">
                {coachBilans.length}
              </Badge>
            </h2>
            <div className="space-y-4">
              {coachBilans.map((bilan) => {
                const meta = SUBJECT_META[bilan.subject] ?? {
                  label: bilan.subject,
                  icon: FileText,
                  color: 'text-neutral-400',
                };
                const Icon = meta.icon;
                const childName = bilan.student?.user
                  ? `${bilan.student.user.firstName ?? ''} ${bilan.student.user.lastName ?? ''}`.trim()
                  : bilan.studentName;
                const isExpanded = expandedBilanId === bilan.id;
                const publishDate = bilan.publishedAt ? new Date(bilan.publishedAt) : new Date(bilan.createdAt);

                return (
                  <Card key={bilan.id} className="bg-surface-card border border-white/10">
                    <CardHeader className="cursor-pointer" onClick={() => setExpandedBilanId(isExpanded ? null : bilan.id)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Icon className={`w-5 h-5 mt-1 ${meta.color}`} />
                          <div>
                            <CardTitle className="text-white text-base">
                              {bilan.stage?.title ?? 'Stage'} — {meta.label}
                            </CardTitle>
                            <p className="text-xs text-neutral-400 mt-1">
                              {childName} • Publié le {publishDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              {bilan.coach?.pseudonym ? ` • Coach ${bilan.coach.pseudonym}` : ''}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-brand-accent shrink-0">
                          {isExpanded ? 'Replier' : 'Lire le bilan'}
                        </Button>
                      </div>
                    </CardHeader>
                    {isExpanded && bilan.parentsMarkdown && (
                      <CardContent className="pt-0">
                        <div className="bg-white rounded-xl p-6 border border-indigo-100">
                          <BilanParentPreview bilanText={bilan.parentsMarkdown} />
                        </div>
                      </CardContent>
                    )}
                    {isExpanded && !bilan.parentsMarkdown && (
                      <CardContent>
                        <p className="text-sm text-neutral-500 italic">Le contenu de ce bilan est en cours de génération.</p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Legacy StageBilan display */}
        {legacyBilans.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-accent" />
              Anciens bilans
            </h2>
            <div className="space-y-4">
              {legacyBilans.map((b) => (
                <Card key={b.id} className="bg-surface-card border border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-base">{b.stage?.title ?? 'Stage'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {b.contentParent ? (
                      <div className="text-sm text-neutral-300 whitespace-pre-wrap">{b.contentParent}</div>
                    ) : b.pdfUrl ? (
                      <a href={b.pdfUrl} target="_blank" rel="noreferrer" className="text-brand-accent underline text-sm">
                        Télécharger le bilan (PDF)
                      </a>
                    ) : (
                      <p className="text-sm text-neutral-500 italic">Contenu non disponible.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming reservations */}
        {reservations.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-accent" />
              Stages confirmés
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservations.map((r) => (
                <Card key={r.id} className="bg-surface-card border border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white text-base">{r.stage?.title ?? 'Stage'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-neutral-400">
                      {r.stage?.sessions?.length ?? 0} séance{(r.stage?.sessions?.length ?? 0) > 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
