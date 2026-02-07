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
        badges: Array<{ id: string; name: string; icon: string }>;
        recentScores: Array<{ subject: string; score: number; date: string }>;
        recentSessions: Array<{ id: string; subject: string; date: string; coachName: string }>;
    }>;
    payments: Array<{ id: string; amount: number; status: string; createdAt: string }>;
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
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center p-4">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-lg font-semibold text-gray-900">Une erreur est survenue</h2>
                <p className="text-gray-500 mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>Réessayer</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8">

            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Espace Parent</h1>
                    <p className="text-muted-foreground mt-1">
                        Suivez la progression de vos enfants et gérez vos paiements.
                    </p>
                </div>
                <div className="mt-4 md:mt-0">
                    <Button>Ajouter un nouvel enfant</Button>
                </div>
            </div>

            {/* Children List */}
            <section>
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Mes Enfants</h2>
                <ChildrenList childrenData={data?.children || []} />
            </section>

            {/* Charts & Analytics */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ScoreChart childrenData={data?.children || []} />
                </div>
                <div>
                    {/* Placeholder for future widgets like "Next Report" or "Alerts" */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white h-full flex flex-col justify-center items-center text-center">
                        <h3 className="text-xl font-bold mb-2">Prochain Bilan</h3>
                        <p className="text-indigo-100 mb-4">Le prochain bilan trimestriel sera disponible le 15 Mars.</p>
                        <Button variant="secondary" size="sm">En savoir plus</Button>
                    </div>
                </div>
            </section>

            {/* Transactions */}
            <section>
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Historique Financier</h2>
                <TransactionHistory transactions={data?.payments || []} />
            </section>
        </div>
    );
}
