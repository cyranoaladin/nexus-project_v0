"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Edit, Loader2, LogOut, Plus, Search, Trash2, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  profile: Record<string, unknown> | null;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
  profileData?: {
    pseudonym?: string;
    subjects?: string[];
    bio?: string;
    hourlyRate?: number;
  };
}

export default function UsersManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    firstName: "",
    lastName: "",
    role: "ELEVE",
    password: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        role: roleFilter,
        search: searchTerm
      });
      
      const response = await fetch(`/api/admin/users?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentPage, roleFilter, searchTerm]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    fetchUsers();
  }, [session, status, router, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const result = await response.json();
      alert(result.message);
      
      // Reset form and refresh
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "ELEVE",
        password: ""
      });
      setIsDialogOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingUser.id,
          ...formData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      const result = await response.json();
      alert(result.message);
      
      // Reset form and refresh
      setEditingUser(null);
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "ELEVE",
        password: ""
      });
      setIsDialogOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      const result = await response.json();
      alert(result.message);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      password: ""
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "ELEVE",
      password: ""
    });
    setIsDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'destructive';
      case 'ASSISTANTE': return 'default';
      case 'COACH': return 'secondary';
      case 'PARENT': return 'outline';
      case 'ELEVE': return 'default';
      default: return 'outline';
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des utilisateurs...</p>
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
            onClick={() => fetchUsers()} 
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
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Gestion des Utilisateurs
                  </h1>
                  <p className="text-sm text-neutral-400">Administration complète</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin">
                <Button variant="ghost" className="text-neutral-300 hover:text-white">
                  Retour au Dashboard
                </Button>
              </Link>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Gestion des Utilisateurs
              </h2>
              <p className="text-neutral-400">
                Gérez tous les utilisateurs de la plateforme
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter Utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Modifier Utilisateur' : 'Ajouter Utilisateur'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Prénom *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Nom *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="role">Rôle *</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                        <SelectItem value="ASSISTANTE">Assistante</SelectItem>
                        <SelectItem value="COACH">Coach</SelectItem>
                        <SelectItem value="PARENT">Parent</SelectItem>
                        <SelectItem value="ELEVE">Élève</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!editingUser && (
                    <div>
                      <Label htmlFor="password">Mot de passe *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {formData.role === 'COACH' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="pseudonym">Pseudonyme</Label>
                        <Input
                          id="pseudonym"
                          value={formData.profileData?.pseudonym || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            profileData: { ...formData.profileData, pseudonym: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={formData.profileData?.bio || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            profileData: { ...formData.profileData, bio: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-4">
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        editingUser ? 'Modifier' : 'Créer'
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-48 border-white/10 bg-surface-elevated text-neutral-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              <SelectItem value="ADMIN">Administrateurs</SelectItem>
              <SelectItem value="ASSISTANTE">Assistantes</SelectItem>
              <SelectItem value="COACH">Coaches</SelectItem>
              <SelectItem value="PARENT">Parents</SelectItem>
              <SelectItem value="ELEVE">Élèves</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <Card className="bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="text-white">Utilisateurs ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-300">
                    <th className="text-left py-3 px-4 font-medium">Utilisateur</th>
                    <th className="text-left py-3 px-4 font-medium">Rôle</th>
                    <th className="text-left py-3 px-4 font-medium">Statut</th>
                    <th className="text-left py-3 px-4 font-medium">Date d'inscription</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-white">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-neutral-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getRoleBadgeVariant(user.role) as "default" | "outline" | "popular" | "success" | "warning" | "destructive" | null | undefined}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-400">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </Button>
                  <span className="flex items-center px-3 py-2 text-sm text-neutral-300">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 
