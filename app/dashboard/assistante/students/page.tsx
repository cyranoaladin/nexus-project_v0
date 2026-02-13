"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, LogOut, Search, Settings, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
  school: string;
  creditBalance: number;
}

export default function StudentsManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchStudents();
  }, [session, status, router]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/assistant/students/credits');
      
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.school.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des élèves...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
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
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/assistante" className="flex items-center space-x-2">
                <Settings className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Gestion des Élèves
                  </h1>
                  <p className="text-sm text-neutral-400">Administration des élèves</p>
                </div>
              </Link>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-300 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Gestion des Élèves
              </h2>
              <p className="text-neutral-400">
                Gérez tous les élèves de Nexus Réussite
              </p>
            </div>
            <div className="flex space-x-2">
              <Link href="/dashboard/assistante/credits">
                <Button variant="outline" className="border-white/10 text-neutral-200 hover:text-white">
                  <Users className="w-4 h-4 mr-2" />
                  Gérer les Crédits
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-brand-accent">{students.length}</div>
              <p className="text-sm text-neutral-400">Total Élèves</p>
            </CardContent>
          </Card>
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-300">
                {students.filter(s => s.creditBalance > 0).length}
              </div>
              <p className="text-sm text-neutral-400">Avec Crédits</p>
            </CardContent>
          </Card>
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-300">
                {students.filter(s => s.creditBalance === 0).length}
              </div>
              <p className="text-sm text-neutral-400">Sans Crédits</p>
            </CardContent>
          </Card>
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-rose-300">
                {students.filter(s => s.creditBalance < 0).length}
              </div>
              <p className="text-sm text-neutral-400">Déficit</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher un élève..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
            />
          </div>
        </div>

        {/* Students Table */}
        <Card className="bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="text-white">Liste des Élèves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-300">
                    <th className="text-left p-3 font-medium">Nom</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Niveau</th>
                    <th className="text-left p-3 font-medium">École</th>
                    <th className="text-left p-3 font-medium">Crédits</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="p-3">
                        <div>
                          <div className="font-medium text-white">{student.firstName} {student.lastName}</div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="border-white/10 text-neutral-300">{student.grade}</Badge>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.school}</td>
                      <td className="p-3">
                        <Badge 
                          variant={student.creditBalance >= 0 ? "default" : "destructive"}
                        >
                          {student.creditBalance} crédits
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <Link href={`/dashboard/assistante/credits?studentId=${student.id}`}>
                            <Button variant="outline" size="sm" className="border-white/10 text-neutral-200 hover:text-white">
                              Gérer Crédits
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Aucun élève trouvé
            </h3>
            <p className="text-neutral-400">
              {searchTerm ? 'Aucun élève ne correspond à votre recherche.' : 'Aucun élève n\'a encore été créé.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 
