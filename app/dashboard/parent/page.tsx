"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, CreditCard, TrendingUp, Users, User, LogOut, Loader2, Settings, Plus } from "lucide-react"
import { signOut } from "next-auth/react"

export default function DashboardParent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedChild, setSelectedChild] = useState<string>("")
  const [parentData, setParentData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin")
      return
    }

    // Simulation de chargement des données parent
    setTimeout(() => {
      const mockData = {
        children: [
          {
            id: "1",
            firstName: "Emma",
            lastName: "Martin",
            grade: "Terminale",
            credits: 4.5,
            subscription: "HYBRIDE",
            nextSession: "Mathématiques - Demain 14h",
            progress: 78
          }
        ]
      }
      setParentData(mockData)
      if (mockData.children.length > 0) {
        setSelectedChild(mockData.children[0].id)
      }
      setLoading(false)
    }, 1000)
  }, [session, status, router])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de votre espace...</p>
        </div>
      </div>
    )
  }

  const currentChild = parentData?.children.find((child: any) => child.id === selectedChild)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Parent</p>
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
        {/* Welcome Section avec Sélecteur d'Enfant */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Tableau de Bord Parental 👨‍👩‍👧‍👦
              </h2>
              <p className="text-gray-600">
                Suivez les progrès et gérez l'accompagnement de vos enfants.
              </p>
            </div>
            
            {/* Sélecteur Multi-Enfants */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Enfant :</span>
              </div>
              <Select value={selectedChild} onValueChange={setSelectedChild}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sélectionner un enfant" />
                </SelectTrigger>
                <SelectContent>
                  {parentData?.children.map((child: any) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.firstName} {child.lastName} ({child.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un Enfant
              </Button>
            </div>
          </div>
        </div>

        {currentChild && (
          <>
            {/* Informations Enfant Sélectionné */}
            <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  {currentChild.firstName} {currentChild.lastName}
                  <Badge variant="outline" className="ml-2">
                    {currentChild.grade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentChild.credits}
                    </div>
                    <p className="text-sm text-gray-600">Crédits disponibles</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {currentChild.subscription}
                    </div>
                    <p className="text-sm text-gray-600">Formule actuelle</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {currentChild.progress}%
                    </div>
                    <p className="text-sm text-gray-600">Progression</p>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {currentChild.nextSession}
                    </div>
                    <p className="text-sm text-gray-600">Prochaine session</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Agenda de l'Enfant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                    Agenda de {currentChild.firstName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Mathématiques</p>
                        <p className="text-sm text-gray-600">Demain à 14h00</p>
                      </div>
                      <Badge variant="default">En ligne</Badge>
                    </div>
                    <div className="text-center py-8">
                      <p className="text-gray-500">Aucune autre session programmée</p>
                      <Button variant="outline" className="mt-2">
                        Réserver une Session
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progression */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Progression
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Mathématiques</span>
                        <span>85%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Français</span>
                        <span>72%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '72%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Physique-Chimie</span>
                        <span>68%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '68%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section Abonnement et Facturation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                  Abonnement et Facturation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Abonnement Actuel */}
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Formule Actuelle</h3>
                    <div className="text-2xl font-bold text-blue-600 mb-1">HYBRIDE</div>
                    <p className="text-sm text-gray-600 mb-3">450 TND/mois</p>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                  </div>

                  {/* Prochaine Facturation */}
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Prochaine Facturation</h3>
                    <div className="text-2xl font-bold text-green-600 mb-1">15 Fév</div>
                    <p className="text-sm text-gray-600 mb-3">450 TND</p>
                    <Button variant="outline" size="sm">
                      Voir Détails
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">Actions</h3>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full">
                        Acheter des Crédits
                      </Button>
                      <Button variant="outline" size="sm" className="w-full">
                        Ajouter ARIA+
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Note importante */}
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note :</strong> Les fonctionnalités de paiement et de modification d'abonnement 
                    seront disponibles dans la prochaine mise à jour de la plateforme.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}