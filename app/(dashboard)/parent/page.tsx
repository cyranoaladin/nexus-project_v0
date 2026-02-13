"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChildrenList } from "@/components/dashboard/parent/children-list";
import { TransactionHistory } from "@/components/dashboard/parent/transaction-history";
import { ScoreChart } from "@/components/dashboard/parent/score-chart";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardData {
    children: Array<{
        id: string;
        name: string;
        grade: string | null;
        school: string | null;
        credits: number;
        badges: Array<{ 
            id: string; 
            name: string; 
            icon: string | null;
            category: string;
            earnedAt: string;
        }>;
        recentScores: Array<{ 
            subject: string; 
            rating: number;
            date: string;
        }>;
        recentSessions: Array<{ id: string; subject: string; date: string; coachName: string }>;
    }>;
    payments: Array<{ 
        id: string; 
        date: string;
        amount: number; 
        description: string;
        type: string;
        status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    }>;
}

export default function ParentDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "loading") return;

        if (!session || session.user.role !== 'PARENT') {
            router.push("/auth/signin");
            return;
        }

        const fetchData = async () => {
            try {
                const res = await fetch('/api/parent/dashboard');
                if (!res.ok) throw new Error('Erreur lors du chargement des données');
                const jsonData = await res.json();
                setData(jsonData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [session, status, router]);

    if (status === "loading" || loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-surface-darker">
                <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center p-4 bg-surface-darker text-center">
                <AlertCircle className="h-12 w-12 text-rose-300 mb-4" />
                <h2 className="text-lg font-semibold text-white">Une erreur est survenue</h2>
                <p className="text-neutral-400 mb-4">{error}</p>
                <Button className="btn-primary" onClick={() => window.location.reload()}>Réessayer</Button>
            </div>
        );
    }

    const totalCredits = data?.children?.reduce((sum, child) => sum + child.credits, 0) ?? 0;
    const totalChildren = data?.children?.length ?? 0;
    const totalPayments = data?.payments?.length ?? 0;

    return (
        <div className="min-h-screen bg-surface-darker p-6 space-y-8 text-neutral-100">

            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-neutral-200">
                        Dashboard Parent
                    </div>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Espace Parent</h1>
                    <p className="text-neutral-300 mt-1">
                        Suivez la progression de vos enfants et gérez vos paiements.
                    </p>
                </div>
                <div className="mt-4 md:mt-0">
                    <Button className="btn-primary">Ajouter un nouvel enfant</Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-surface-card p-5 shadow-premium">
                    <div className="text-sm text-neutral-400">Enfants suivis</div>
                    <div className="mt-2 text-2xl font-bold text-white">{totalChildren}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-surface-card p-5 shadow-premium">
                    <div className="text-sm text-neutral-400">Crédits disponibles</div>
                    <div className="mt-2 text-2xl font-bold text-brand-accent">{totalCredits}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-surface-card p-5 shadow-premium">
                    <div className="text-sm text-neutral-400">Transactions récentes</div>
                    <div className="mt-2 text-2xl font-bold text-white">{totalPayments}</div>
                </div>
            </div>

            {/* Children List */}
            <section>
                <h2 className="text-xl font-semibold mb-4 text-white">Mes Enfants</h2>
                <ChildrenList childrenData={data?.children || []} />
            </section>

            {/* Charts & Analytics */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ScoreChart childrenData={data?.children || []} />
                </div>
                <div>
                    {/* Placeholder for future widgets like "Next Report" or "Alerts" */}
                    <div className="bg-gradient-to-br from-blue-500/80 via-indigo-500/70 to-purple-600/80 rounded-2xl p-6 text-white h-full flex flex-col justify-center items-center text-center border border-white/10 shadow-premium">
                        <h3 className="text-xl font-bold mb-2">Prochain Bilan</h3>
                        <p className="text-indigo-100/90 mb-4">Le prochain bilan trimestriel sera disponible le 15 Mars.</p>
                        <Button className="btn-outline" size="sm">En savoir plus</Button>
                    </div>
                </div>
            </section>

            {/* Transactions */}
            <section>
                <h2 className="text-xl font-semibold mb-4 text-white">Historique Financier</h2>
                <TransactionHistory transactions={data?.payments || []} />
            </section>
        </div>
    );
}
