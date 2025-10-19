"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Loader2, LogOut, Mail, MessageSquare } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function SupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchSupportMessages();
  }, [session, status, router]);

  const fetchSupportMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simuler des messages de support pour la démo
      const mockMessages: SupportMessage[] = [
        {
          id: '1',
          subject: 'Problème de connexion',
          message: 'Je n\'arrive pas à me connecter à mon compte élève.',
          status: 'OPEN',
          priority: 'HIGH',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          user: {
            firstName: 'Marie',
            lastName: 'Dubois',
            email: 'marie@nexus-reussite.com'
          }
        },
        {
          id: '2',
          subject: 'Question sur les crédits',
          message: 'Comment puis-je acheter des crédits supplémentaires ?',
          status: 'OPEN',
          priority: 'MEDIUM',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          user: {
            firstName: 'Ahmed',
            lastName: 'Ben Ali',
            email: 'parent1@nexus-reussite.com'
          }
        },
        {
          id: '3',
          subject: 'Demande de remboursement',
          message: 'Je souhaite annuler mon abonnement et être remboursé.',
          status: 'CLOSED',
          priority: 'LOW',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          user: {
            firstName: 'Sarah',
            lastName: 'Trabelsi',
            email: 'sarah@nexus-reussite.com'
          }
        }
      ];

      setMessages(mockMessages);
    } catch (err) {
      console.error('Error fetching support messages:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="destructive">Ouvert</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default">En cours</Badge>;
      case 'CLOSED':
        return <Badge variant="outline">Fermé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'MEDIUM':
        return <Badge variant="default">Normal</Badge>;
      case 'LOW':
        return <Badge variant="outline">Faible</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des messages de support...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/assistante">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour au tableau de bord
                </Link>
              </Button>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900 text-sm md:text-base">
                    Support Client
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">Messages et demandes</p>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Messages ouverts</p>
                  <p className="text-2xl font-bold">{messages.filter(m => m.status === 'OPEN').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Urgents</p>
                  <p className="text-2xl font-bold">{messages.filter(m => m.priority === 'HIGH').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Total</p>
                  <p className="text-2xl font-bold">{messages.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages List */}
        <Card>
          <CardHeader>
            <CardTitle>Messages de support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-lg">{message.subject}</h3>
                      <p className="text-sm text-gray-600">
                        {message.user ? `${message.user.firstName} ${message.user.lastName}` : 'Utilisateur inconnu'}
                        ({message.user?.email})
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getPriorityBadge(message.priority)}
                      {getStatusBadge(message.status)}
                    </div>
                  </div>
                  <p className="text-gray-700 mb-3">{message.message}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      Reçu le {new Date(message.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        Répondre
                      </Button>
                      {message.status === 'OPEN' && (
                        <Button size="sm">
                          Marquer comme traité
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
