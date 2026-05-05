"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, CreditCard, Loader2, LogOut, Search, Settings, X } from "lucide-react";

type PendingSubscription = {
  id: string;
  planName: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  status: string;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
    school: string;
  };
  parent: {
    firstName: string;
    lastName: string;
    email: string;
  };
};

type Subscription = {
  id: string;
  planName: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  status: string;
  createdAt: string;
  startDate: string;
  endDate: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
  };
  parent: {
    firstName: string;
    lastName: string;
  };
};

type SubscriptionChangeRequest = {
  id: string;
  studentId: string;
  requestType: string;
  planName: string | null;
  monthlyPrice: number;
  reason: string | null;
  status: string;
  requestedBy: string;
  requestedByEmail: string;
  createdAt: string;
  processedBy: string | null;
  processedAt: string | null;
  rejectionReason: string | null;
  student: {
    user: {
      firstName: string | null;
      lastName: string | null;
    };
    parent: {
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string;
      };
    };
  };
};

type TabKey = "pending" | "requests" | "active";

export default function AssistanteSubscriptionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabKey>("pending");

  const [pendingSubscriptions, setPendingSubscriptions] = useState<PendingSubscription[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);

  const [requests, setRequests] = useState<SubscriptionChangeRequest[]>([]);
  const [requestsStatus, setRequestsStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [studentIdFilter, setStudentIdFilter] = useState<string | null>(null);

  const [pendingRejectionReason, setPendingRejectionReason] = useState("");
  const [pendingProcessing, setPendingProcessing] = useState(false);

  const [requestRejectionReason, setRequestRejectionReason] = useState("");
  const [requestProcessing, setRequestProcessing] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ASSISTANTE") {
      router.push("/auth/signin");
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    const tabParam = (searchParams.get("tab") || "").toLowerCase();
    if (tabParam === "requests") setTab("requests");
    else if (tabParam === "active") setTab("active");
    else if (tabParam === "pending") setTab("pending");

    const sid = searchParams.get("studentId");
    setStudentIdFilter(sid && sid.trim() ? sid : null);
  }, [searchParams]);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/assistante/subscriptions");
      if (!response.ok) throw new Error("Failed to fetch subscriptions");

      const data = await response.json();
      setPendingSubscriptions((data.pendingSubscriptions || []) as PendingSubscription[]);
      setAllSubscriptions((data.allSubscriptions || []) as Subscription[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const response = await fetch(`/api/assistante/subscription-requests?status=${requestsStatus}`);
      if (!response.ok) throw new Error("Failed to fetch requests");
      const data = await response.json();
      setRequests((data.requests || []) as SubscriptionChangeRequest[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setRequestsLoading(false);
    }
  }, [requestsStatus]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchSubscriptions();
  }, [status, fetchSubscriptions]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchRequests();
  }, [status, fetchRequests]);

  const handlePendingAction = async (subscriptionId: string, action: "approve" | "reject") => {
    setPendingProcessing(true);
    try {
      const response = await fetch("/api/assistante/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId,
          action,
          reason: action === "reject" ? pendingRejectionReason : undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || body?.message || "Failed to process subscription");

      alert(body?.subscription?.message || "Traitement terminé");
      setPendingRejectionReason("");
      fetchSubscriptions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to process subscription");
    } finally {
      setPendingProcessing(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: "APPROVED" | "REJECTED") => {
    setRequestProcessing(true);
    try {
      const response = await fetch("/api/assistante/subscription-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          reason: action === "REJECTED" ? requestRejectionReason : null,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Une erreur est survenue");

      alert(body?.message || "Demande traitée");
      setRequestRejectionReason("");
      fetchRequests();
      fetchSubscriptions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setRequestProcessing(false);
    }
  };

  const filteredPending = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return pendingSubscriptions.filter((sub) => {
      if (studentIdFilter && sub.student.id !== studentIdFilter) return false;
      if (!term) return true;
      const hay = `${sub.student.firstName} ${sub.student.lastName} ${sub.parent.firstName} ${sub.parent.lastName} ${sub.planName}`.toLowerCase();
      return hay.includes(term);
    });
  }, [pendingSubscriptions, searchTerm, studentIdFilter]);

  const filteredActive = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allSubscriptions
      .filter((sub) => sub.status === "ACTIVE")
      .filter((sub) => {
        if (studentIdFilter && sub.student.id !== studentIdFilter) return false;
        if (!term) return true;
        const hay = `${sub.student.firstName} ${sub.student.lastName} ${sub.parent.firstName} ${sub.parent.lastName} ${sub.planName}`.toLowerCase();
        return hay.includes(term);
      });
  }, [allSubscriptions, searchTerm, studentIdFilter]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return requests.filter((req) => {
      if (studentIdFilter && req.studentId !== studentIdFilter) return false;
      if (!term) return true;
      const hay = `${req.student.user.firstName || ""} ${req.student.user.lastName || ""} ${req.student.parent.user.firstName || ""} ${req.student.parent.user.lastName || ""} ${req.planName || ""} ${req.requestType}`.toLowerCase();
      return hay.includes(term);
    });
  }, [requests, searchTerm, studentIdFilter]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des abonnements...</p>
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
          <Button onClick={() => fetchSubscriptions()} className="btn-primary mt-4">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const pendingCount = pendingSubscriptions.length;
  const activeCount = allSubscriptions.filter((s) => s.status === "ACTIVE").length;
  const requestCount = requestsStatus === "PENDING" ? filteredRequests.length : requests.length;

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
                  <h1 className="font-semibold text-white">Abonnements</h1>
                  <p className="text-sm text-neutral-400">Souscriptions, demandes, actifs</p>
                </div>
              </Link>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-neutral-300 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Gestion des abonnements</h2>
            <p className="text-neutral-400 text-sm">
              Validez les souscriptions, traitez les demandes, suivez les abonnements actifs.
            </p>
          </div>
          {studentIdFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/10 text-neutral-300">
                Filtre élève actif
              </Badge>
              <Button
                variant="outline"
                className="border-white/10 text-neutral-200 hover:text-white"
                onClick={() => router.push("/dashboard/assistante/subscriptions")}
              >
                Effacer
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
          <Input
            placeholder="Rechercher (élève, parent, plan)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="bg-surface-elevated text-neutral-300">
            <TabsTrigger value="pending" className="data-[state=active]:bg-surface-card data-[state=active]:text-white">
              Souscriptions <span className="ml-2 text-xs text-neutral-400">({pendingCount})</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-surface-card data-[state=active]:text-white">
              Demandes <span className="ml-2 text-xs text-neutral-400">({requestCount})</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-surface-card data-[state=active]:text-white">
              Actifs <span className="ml-2 text-xs text-neutral-400">({activeCount})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              {filteredPending.length > 0 ? (
                filteredPending.map((sub) => (
                  <Card key={sub.id} className="border-blue-500/20 bg-blue-500/10">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg text-white">
                            {sub.planName} — {sub.student.firstName} {sub.student.lastName}
                          </CardTitle>
                          <p className="text-sm text-neutral-300">
                            Parent : {sub.parent.firstName} {sub.parent.lastName}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {new Date(sub.createdAt).toLocaleDateString("fr-FR")} à{" "}
                            {new Date(sub.createdAt).toLocaleTimeString("fr-FR")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-slate-200 border-blue-500/30">
                          En attente
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-200">Élève</p>
                          <p className="text-sm text-neutral-300">
                            {sub.student.firstName} {sub.student.lastName}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {sub.student.grade} {sub.student.school ? `— ${sub.student.school}` : ""}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-200">Prix</p>
                          <p className="text-sm text-neutral-300">{sub.monthlyPrice} TND/mois</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-200">Crédits</p>
                          <p className="text-sm text-neutral-300">{sub.creditsPerMonth} crédits/mois</p>
                        </div>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/10 text-neutral-200 hover:text-white"
                          >
                            Voir détails
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                          <DialogHeader>
                            <DialogTitle className="text-white">Détails de la souscription</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium text-neutral-200">Élève</Label>
                                <p className="text-sm text-neutral-300">
                                  {sub.student.firstName} {sub.student.lastName}
                                </p>
                                <p className="text-xs text-neutral-400">{sub.student.grade}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-neutral-200">Parent</Label>
                                <p className="text-sm text-neutral-300">
                                  {sub.parent.firstName} {sub.parent.lastName}
                                </p>
                                <p className="text-xs text-neutral-400">{sub.parent.email}</p>
                              </div>
                            </div>

                            <div>
                              <Label className="text-sm font-medium text-neutral-200">Abonnement</Label>
                              <p className="text-sm font-medium text-neutral-100">{sub.planName}</p>
                              <p className="text-sm text-neutral-300">{sub.monthlyPrice} TND/mois</p>
                              <p className="text-xs text-neutral-400">{sub.creditsPerMonth} crédits inclus</p>
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                onClick={() => handlePendingAction(sub.id, "approve")}
                                className="flex-1 btn-primary"
                                disabled={pendingProcessing}
                              >
                                {pendingProcessing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Traitement...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Approuver
                                  </>
                                )}
                              </Button>

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="flex-1 border-white/10 text-neutral-200 hover:text-white"
                                    disabled={pendingProcessing}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Rejeter
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                                  <DialogHeader>
                                    <DialogTitle className="text-white">Rejeter la souscription</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="pendingRejectionReason" className="text-neutral-200">
                                        Raison du rejet
                                      </Label>
                                      <Textarea
                                        id="pendingRejectionReason"
                                        value={pendingRejectionReason}
                                        onChange={(e) => setPendingRejectionReason(e.target.value)}
                                        placeholder="Expliquez pourquoi cette souscription est rejetée..."
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex space-x-2">
                                      <Button
                                        onClick={() => handlePendingAction(sub.id, "reject")}
                                        variant="secondary"
                                        className="flex-1 btn-secondary"
                                        disabled={pendingProcessing}
                                      >
                                        {pendingProcessing ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Traitement...
                                          </>
                                        ) : (
                                          "Rejeter"
                                        )}
                                      </Button>
                                      <Button variant="outline" className="flex-1 border-white/10 text-neutral-200 hover:text-white">
                                        Annuler
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Check className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Aucune souscription en attente</h3>
                  <p className="text-neutral-400">
                    {searchTerm ? "Aucune souscription ne correspond à votre recherche." : "Toutes les souscriptions ont été traitées."}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-white/10 text-neutral-300">
                  Statut
                </Badge>
                <Select value={requestsStatus} onValueChange={(v) => setRequestsStatus(v as typeof requestsStatus)}>
                  <SelectTrigger className="w-[200px] border-white/10 bg-surface-elevated text-neutral-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="APPROVED">Approuvées</SelectItem>
                    <SelectItem value="REJECTED">Rejetées</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="border-white/10 text-neutral-200 hover:text-white"
                onClick={() => fetchRequests()}
                disabled={requestsLoading}
              >
                {requestsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Rafraîchir"
                )}
              </Button>
            </div>

            <div className="space-y-4">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const studentName = `${req.student.user.firstName || ""} ${req.student.user.lastName || ""}`.trim() || "Élève";
                  const parentName = `${req.student.parent.user.firstName || ""} ${req.student.parent.user.lastName || ""}`.trim() || "Parent";
                  return (
                    <Card key={req.id} className="bg-surface-card border border-white/10 shadow-premium">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg text-white">
                              {req.requestType} — {studentName}
                            </CardTitle>
                            <p className="text-sm text-neutral-300">Parent : {parentName}</p>
                            <p className="text-xs text-neutral-400">
                              {new Date(req.createdAt).toLocaleDateString("fr-FR")} à{" "}
                              {new Date(req.createdAt).toLocaleTimeString("fr-FR")}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-white/10 text-neutral-300">
                            {req.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-neutral-400">Plan</p>
                            <p className="text-sm text-neutral-200">{req.planName || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-400">Prix mensuel</p>
                            <p className="text-sm text-neutral-200">{req.monthlyPrice} TND</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-400">Demandé par</p>
                            <p className="text-sm text-neutral-200">{req.requestedByEmail}</p>
                          </div>
                        </div>

                        {req.reason && (
                          <div className="rounded border border-white/10 bg-white/5 p-3">
                            <p className="text-xs text-neutral-400 mb-1">Motif</p>
                            <p className="text-sm text-neutral-200">{req.reason}</p>
                          </div>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/10 text-neutral-200 hover:text-white"
                            >
                              Voir / traiter
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                            <DialogHeader>
                              <DialogTitle className="text-white">Demande d’abonnement</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-sm font-medium text-neutral-200">Élève</Label>
                                  <p className="text-sm text-neutral-300">{studentName}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-neutral-200">Parent</Label>
                                  <p className="text-sm text-neutral-300">{parentName}</p>
                                  <p className="text-xs text-neutral-400">{req.student.parent.user.email}</p>
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-neutral-200">Type</Label>
                                <p className="text-sm text-neutral-300">{req.requestType}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-neutral-200">Plan</Label>
                                <p className="text-sm text-neutral-300">{req.planName || "—"}</p>
                                <p className="text-xs text-neutral-400">{req.monthlyPrice} TND/mois</p>
                              </div>

                              {requestsStatus === "PENDING" ? (
                                <div className="flex space-x-2">
                                  <Button
                                    onClick={() => handleRequestAction(req.id, "APPROVED")}
                                    className="flex-1 btn-primary"
                                    disabled={requestProcessing}
                                  >
                                    {requestProcessing ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Traitement...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Approuver
                                      </>
                                    )}
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="flex-1 border-white/10 text-neutral-200 hover:text-white"
                                        disabled={requestProcessing}
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Rejeter
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                                      <DialogHeader>
                                        <DialogTitle className="text-white">Rejeter la demande</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div>
                                          <Label htmlFor="requestRejectionReason" className="text-neutral-200">
                                            Raison du rejet
                                          </Label>
                                          <Textarea
                                            id="requestRejectionReason"
                                            value={requestRejectionReason}
                                            onChange={(e) => setRequestRejectionReason(e.target.value)}
                                            placeholder="Expliquez pourquoi cette demande est rejetée..."
                                            rows={3}
                                          />
                                        </div>
                                        <div className="flex space-x-2">
                                          <Button
                                            onClick={() => handleRequestAction(req.id, "REJECTED")}
                                            variant="secondary"
                                            className="flex-1 btn-secondary"
                                            disabled={requestProcessing}
                                          >
                                            {requestProcessing ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Traitement...
                                              </>
                                            ) : (
                                              "Rejeter"
                                            )}
                                          </Button>
                                          <Button variant="outline" className="flex-1 border-white/10 text-neutral-200 hover:text-white">
                                            Annuler
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              ) : (
                                <div className="rounded border border-white/10 bg-white/5 p-3 text-sm text-neutral-300">
                                  Demande déjà traitée.
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Aucune demande</h3>
                  <p className="text-neutral-400">
                    {searchTerm ? "Aucune demande ne correspond à votre recherche." : "Aucune demande à afficher."}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <div className="space-y-4">
              {filteredActive.length > 0 ? (
                filteredActive.map((sub) => (
                  <Card key={sub.id} className="bg-surface-card border border-white/10 shadow-premium">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg text-white">
                            {sub.planName} — {sub.student.firstName} {sub.student.lastName}
                          </CardTitle>
                          <p className="text-sm text-neutral-300">
                            Parent : {sub.parent.firstName} {sub.parent.lastName}
                          </p>
                          <p className="text-xs text-neutral-400">
                            Début : {new Date(sub.startDate).toLocaleDateString("fr-FR")}
                            {sub.endDate ? ` • Fin : ${new Date(sub.endDate).toLocaleDateString("fr-FR")}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-200">
                          ACTIF
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-neutral-400">Prix</p>
                        <p className="text-sm text-neutral-200">{sub.monthlyPrice} TND/mois</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400">Crédits/mois</p>
                        <p className="text-sm text-neutral-200">{sub.creditsPerMonth}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400">Créé le</p>
                        <p className="text-sm text-neutral-200">{new Date(sub.createdAt).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Aucun abonnement actif</h3>
                  <p className="text-neutral-400">
                    {searchTerm ? "Aucun abonnement ne correspond à votre recherche." : "Aucun abonnement actif à afficher."}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
