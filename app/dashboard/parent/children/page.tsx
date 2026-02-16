"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Loader2, LogOut, Plus, Search, Settings, UserPlus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
  school: string;
  creditBalance: number;
  upcomingSessions: number;
  createdAt: string;
}

export default function ChildrenManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    grade: "",
    school: ""
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    fetchChildren();
  }, [session, status, router]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/parent/children');
      
      if (!response.ok) {
        throw new Error('Failed to fetch children');
      }
      
      const data = await response.json();
      setChildren(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChild = async () => {
    try {
      const response = await fetch('/api/parent/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create child');
      }

      await response.json();
      
      // Reset form and close dialog
      setCreateFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        grade: "",
        school: ""
      });
      setIsCreateDialogOpen(false);
      
      // Refresh children list
      fetchChildren();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create child');
    }
  };

  const filteredChildren = children.filter(child =>
    child.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    child.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    child.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des enfants...</p>
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
              <Link href="/dashboard/parent" className="flex items-center space-x-2">
                <Settings className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Gestion des Enfants
                  </h1>
                  <p className="text-sm text-neutral-400">Administration des enfants</p>
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
                Gestion des Enfants
              </h2>
              <p className="text-neutral-400">
                Gérez les comptes de vos enfants
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un Enfant</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-surface-card border border-white/10 text-neutral-100">
                <DialogHeader>
                  <DialogTitle className="text-white">Ajouter un enfant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-neutral-200">Prénom</Label>
                      <Input
                        id="firstName"
                        value={createFormData.firstName}
                        onChange={(e) => setCreateFormData({...createFormData, firstName: e.target.value})}
                        placeholder="Prénom"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-neutral-200">Nom</Label>
                      <Input
                        id="lastName"
                        value={createFormData.lastName}
                        onChange={(e) => setCreateFormData({...createFormData, lastName: e.target.value})}
                        placeholder="Nom"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="text-neutral-200">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={createFormData.email}
                      onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-neutral-200">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={createFormData.password}
                      onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                      placeholder="Mot de passe"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="grade" className="text-neutral-200">Niveau</Label>
                      <Select 
                        value={createFormData.grade} 
                        onValueChange={(value) => setCreateFormData({...createFormData, grade: value})}
                      >
                        <SelectTrigger className="border-white/10 bg-surface-elevated text-neutral-100">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                          <SelectItem value="6ème">6ème</SelectItem>
                          <SelectItem value="5ème">5ème</SelectItem>
                          <SelectItem value="4ème">4ème</SelectItem>
                          <SelectItem value="3ème">3ème</SelectItem>
                          <SelectItem value="2nde">2nde</SelectItem>
                          <SelectItem value="1ère">1ère</SelectItem>
                          <SelectItem value="Terminale">Terminale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="school" className="text-neutral-200">École</Label>
                      <Input
                        id="school"
                        value={createFormData.school}
                        onChange={(e) => setCreateFormData({...createFormData, school: e.target.value})}
                        placeholder="École"
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button onClick={handleCreateChild} className="flex-1 btn-primary">
                      Créer le Compte
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="flex-1 border-white/10 text-neutral-200 hover:text-white"
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher un enfant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
            />
          </div>
        </div>

        {/* Children Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChildren.map((child) => (
            <Card key={child.id} className="bg-surface-card border border-white/10 shadow-premium hover:shadow-premium-strong transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-white">{child.firstName} {child.lastName}</CardTitle>
                    <p className="text-sm text-neutral-300">{child.email}</p>
                    <p className="text-xs text-neutral-400">{child.grade} - {child.school}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">
                    {child.upcomingSessions} sessions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-400">Crédits:</span>
                    <span className={`font-medium ${child.creditBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {child.creditBalance} crédits
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Créé le {new Date(child.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredChildren.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Aucun enfant trouvé
            </h3>
            <p className="text-neutral-400">
              {searchTerm ? 'Aucun enfant ne correspond à votre recherche.' : 'Aucun enfant n\'a encore été ajouté.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 
