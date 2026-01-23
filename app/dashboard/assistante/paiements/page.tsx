"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, ArrowLeft, Check, X, Clock, Filter } from "lucide-react"
import Link from "next/link"

interface PendingPayment {
  id: string
  user: {
    firstName: string
    lastName: string
    email: string
  }
  amount: number
  description: string
  method: string
  createdAt: string | Date
  metadata: {
    transferReference: string
    transferDate: string
    transferAmount: string
  }
}

export default function PaiementsAssistantePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin")
      return
    }

    // Simulation de chargement des paiements en attente
    setTimeout(() => {
      setPendingPayments([
        {
          id: "pay_1",
          user: { firstName: "Marie", lastName: "Dubois", email: "marie.dubois@email.com" },
          amount: 450,
          description: "Abonnement HYBRIDE",
          method: "wise",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2h
          metadata: {
            transferReference: "NEXUS-ABC123",
            transferDate: "2025-01-15",
            transferAmount: "450"
          }
        },
        {
          id: "pay_2",
          user: { firstName: "Ahmed", lastName: "Ben Ali", email: "ahmed.benali@email.com" },
          amount: 750,
          description: "Pack Grand Oral",
          method: "wise",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // Il y a 6h
          metadata: {
            transferReference: "NEXUS-DEF456",
            transferDate: "2025-01-14",
            transferAmount: "750"
          }
        }
      ])
      setLoading(false)
    }, 1000)
  }, [session, status, router])

  const handleValidatePayment = async (paymentId: string, action: 'approve' | 'reject', note?: string) => {
    try {
      const response = await fetch('/api/payments/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId,
          action,
          note
        })
      })

      if (response.ok) {
        // Retirer le paiement de la liste
        setPendingPayments(prev => prev.filter(p => p.id !== paymentId))
        alert(`Paiement ${action === 'approve' ? 'validé' : 'rejeté'} avec succès`)
      } else {
        alert('Erreur lors de la validation')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Une erreur est survenue')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/assistante">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Validation des Paiements</h1>
              <p className="text-sm text-gray-500">Virements Wise en attente</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2 text-blue-600" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label>Statut :</Label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="wise">Wise uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Badge variant="outline">
                {pendingPayments.length} paiement(s) en attente
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Liste des paiements */}
        <div className="space-y-6">
          {pendingPayments.length > 0 ? (
            pendingPayments.map((payment) => (
              <Card key={payment.id} className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {payment.user.firstName} {payment.user.lastName}
                      </CardTitle>
                      <p className="text-gray-600 text-sm">{payment.user.email}</p>
                      <Badge variant="outline" className="mt-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(payment.createdAt).toLocaleString('fr-FR')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {payment.amount} TND
                      </div>
                      <p className="text-gray-600 text-sm">{payment.description}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Détails du virement */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Détails du Virement</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-600">Référence</Label>
                        <div className="font-mono font-medium">
                          {payment.metadata.transferReference}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-600">Date</Label>
                        <div className="font-medium">
                          {new Date(payment.metadata.transferDate).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-600">Montant déclaré</Label>
                        <div className="font-medium">
                          {payment.metadata.transferAmount} TND
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions de validation */}
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={() => handleValidatePayment(payment.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Valider le Paiement
                    </Button>
                    
                    <Button
                      onClick={() => {
                        const note = prompt("Raison du rejet (optionnel) :")
                        handleValidatePayment(payment.id, 'reject', note || undefined)
                      }}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun paiement en attente
                </h3>
                <p className="text-gray-500">
                  Tous les paiements ont été traités.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
