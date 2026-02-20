"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, ArrowLeft, Check, X, Clock, Filter, RefreshCw, Landmark } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface PendingPayment {
  id: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  amount: number
  description: string
  method: string | null
  type: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

export default function PaiementsAssistantePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [validatingId, setValidatingId] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    try {
      const response = await fetch('/api/payments/pending')
      if (response.ok) {
        const data = await response.json()
        setPendingPayments(data.payments ?? [])
      } else {
        toast.error("Erreur lors du chargement des paiements")
      }
    } catch {
      toast.error("Impossible de charger les paiements")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return

    if (!session || !['ASSISTANTE', 'ADMIN'].includes(session.user.role)) {
      router.push("/auth/signin")
      return
    }

    fetchPayments()
  }, [session, status, router, fetchPayments])

  const handleValidatePayment = async (paymentId: string, action: 'approve' | 'reject', note?: string) => {
    setValidatingId(paymentId)
    try {
      const response = await fetch('/api/payments/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action, note })
      })

      if (response.ok) {
        setPendingPayments(prev => prev.filter(p => p.id !== paymentId))
        if (action === 'approve') {
          toast.success("Paiement validé avec succès")
        } else {
          toast.info("Paiement rejeté")
        }
      } else {
        const result = await response.json()
        toast.error(result.error || 'Erreur lors de la validation')
      }
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setValidatingId(null)
    }
  }

  const filteredPayments = pendingPayments.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'bank_transfer') return p.method === 'bank_transfer'
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <p className="text-neutral-400">Chargement des paiements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" asChild className="mr-4 text-neutral-300 hover:text-white">
                <Link href="/dashboard/assistante">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour au Dashboard
                </Link>
              </Button>
              <div>
                <h1 className="font-semibold text-white">Validation des Paiements</h1>
                <p className="text-sm text-neutral-400">Virements bancaires en attente</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setLoading(true); fetchPayments(); }}
              className="border-white/10 text-neutral-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Actualiser
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres */}
        <Card className="mb-8 bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Filter className="w-5 h-5 mr-2 text-brand-accent" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label className="text-neutral-200">Méthode :</Label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-48 border-white/10 bg-surface-elevated text-neutral-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="bank_transfer">Virements bancaires</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Badge variant="outline" className="border-white/10 text-neutral-300">
                {filteredPayments.length} paiement(s) en attente
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Liste des paiements */}
        <div className="space-y-6">
          {filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => {
              const meta = (payment.metadata ?? {}) as Record<string, unknown>
              const userName = [payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(' ') || 'Utilisateur inconnu'
              const isValidating = validatingId === payment.id

              return (
                <Card key={payment.id} className="border-amber-500/20 bg-amber-500/5">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-white">
                          {userName}
                        </CardTitle>
                        <p className="text-neutral-300 text-sm">{payment.user?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="border-white/10 text-neutral-300">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(payment.createdAt).toLocaleString('fr-FR')}
                          </Badge>
                          <Badge variant="outline" className="border-brand-primary/30 text-brand-primary">
                            <Landmark className="w-3 h-3 mr-1" />
                            Virement bancaire
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-amber-200">
                          {payment.amount} TND
                        </div>
                        <p className="text-neutral-300 text-sm">{payment.description}</p>
                        <p className="text-xs text-neutral-500 mt-1">{payment.type}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Détails du virement */}
                    <div className="bg-surface-card rounded-lg p-4 border border-white/10">
                      <h4 className="font-semibold text-white mb-3">Détails de la déclaration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-neutral-400">Produit</Label>
                          <div className="font-medium text-neutral-200">
                            {(meta.itemKey as string) || '—'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-neutral-400">Type</Label>
                          <div className="font-medium text-neutral-200">
                            {(meta.itemType as string) || '—'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-neutral-400">Déclaré le</Label>
                          <div className="font-medium text-neutral-200">
                            {meta.declaredAt
                              ? new Date(meta.declaredAt as string).toLocaleString('fr-FR')
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions de validation */}
                    <div className="flex items-center space-x-4">
                      <Button
                        onClick={() => handleValidatePayment(payment.id, 'approve')}
                        disabled={isValidating}
                        className="bg-emerald-500/80 hover:bg-emerald-500 text-white"
                      >
                        {isValidating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Valider le Paiement
                      </Button>
                      
                      <Button
                        onClick={() => {
                          const note = prompt("Raison du rejet (optionnel) :")
                          handleValidatePayment(payment.id, 'reject', note || undefined)
                        }}
                        disabled={isValidating}
                        variant="outline"
                        className="border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rejeter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card className="bg-surface-card border border-white/10 shadow-premium">
              <CardContent className="text-center py-12">
                <CreditCard className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Aucun paiement en attente
                </h3>
                <p className="text-neutral-400">
                  Tous les virements bancaires ont été traités.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
