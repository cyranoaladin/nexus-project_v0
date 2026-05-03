'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2, GraduationCap, FileText, ArrowLeft, AlertCircle, BookOpen, Calculator } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BilanParentPreview from '@/components/bilan/BilanParentPreview';

type CoachBilan = {
  id: string;
  subject: string;
  studentMarkdown: string | null;
  publishedAt: string | null;
  createdAt: string;
  stage: { title: string } | null;
  coach: { pseudonym: string | null } | null;
};

const SUBJECT_META: Record<string, { label: string; icon: typeof Calculator; color: string }> = {
  MATHEMATIQUES: { label: 'Mathématiques', icon: Calculator, color: 'text-indigo-400' },
  FRANCAIS: { label: 'Français / EAF', icon: BookOpen, color: 'text-rose-400' },
};

export default function EleveStagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bilans, setBilans] = useState<CoachBilan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ELEVE') {
      router.push('/auth/signin');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/eleve/stages');
        if (!res.ok) throw new Error('Impossible de charger vos bilans de stage.');
        const data = await res.json();
        setBilans(data.coachBilans ?? []);
        if ((data.coachBilans ?? []).length === 1) setExpandedId(data.coachBilans[0].id);
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
          <Link href="/dashboard/eleve">
            <Button variant="outline" className="border-white/10">Retour</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard/eleve">
          <Button variant="ghost" className="mb-6 text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <GraduationCap className="w-8 h-8 text-brand-accent" />
          <div>
            <h1 className="text-2xl font-bold text-white">Mes stages & bilans</h1>
            <p className="text-sm text-neutral-400">Consultez les bilans rédigés par tes coachs.</p>
          </div>
        </div>

        {bilans.length === 0 && (
          <Card className="bg-surface-card border border-white/10">
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-neutral-500" />
              <p className="text-neutral-300">Aucun bilan disponible pour le moment.</p>
            </CardContent>
          </Card>
        )}

        {bilans.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-accent" />
              Bilans
              <Badge variant="outline" className="ml-1 border-white/10 text-neutral-400">{bilans.length}</Badge>
            </h2>
            <div className="space-y-4">
              {bilans.map((b) => {
                const meta = SUBJECT_META[b.subject] ?? { label: b.subject, icon: FileText, color: 'text-neutral-400' };
                const Icon = meta.icon;
                const isExpanded = expandedId === b.id;
                const publishDate = b.publishedAt ? new Date(b.publishedAt) : new Date(b.createdAt);
                return (
                  <Card key={b.id} className="bg-surface-card border border-white/10">
                    <CardHeader className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Icon className={`w-5 h-5 mt-1 ${meta.color}`} />
                          <div>
                            <CardTitle className="text-white text-base">{b.stage?.title ?? 'Stage'} — {meta.label}</CardTitle>
                            <p className="text-xs text-neutral-400 mt-1">
                              Publié le {publishDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              {b.coach?.pseudonym ? ` • Coach ${b.coach.pseudonym}` : ''}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-brand-accent shrink-0">
                          {isExpanded ? 'Replier' : 'Lire le bilan'}
                        </Button>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0">
                        {b.studentMarkdown ? (
                          <div className="bg-white rounded-xl p-6 border border-indigo-100">
                            <BilanParentPreview bilanText={b.studentMarkdown} />
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-500 italic">Le contenu de ce bilan est en cours de génération.</p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
