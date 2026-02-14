"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, GraduationCap, Users, Building2, Loader2 } from "lucide-react";

interface DiagnosticResult {
  id: string;
  type: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  status: string;
  mathAverage: string | null;
  data: {
    version: string;
    scoring?: {
      readinessScore: number;
      riskIndex: number;
      recommendation: string;
      recommendationMessage: string;
      domainScores: Array<{
        domain: string;
        score: number;
        evaluatedCount: number;
        totalCount: number;
        gaps: string[];
        dominantErrors: string[];
        priority: string;
      }>;
      alerts: Array<{
        type: string;
        code: string;
        message: string;
      }>;
      dataQuality: {
        activeDomains: number;
        evaluatedCompetencies: number;
        lowConfidence: boolean;
      };
    };
  };
  analysisResult: string | null;
  actionPlan: string | null;
  createdAt: string;
}

interface ParsedBilans {
  eleve: string;
  parents: string;
  nexus: string;
  generatedAt?: string;
}

/**
 * Bilan Consultation Page — Accessible by diagnostic ID.
 * Shows the tri-audience bilan (élève, parents, Nexus) with tabs.
 */
export default function BilanResultatPage() {
  const params = useParams();
  const id = params.id as string;

  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [bilans, setBilans] = useState<ParsedBilans | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDiagnostic() {
      try {
        const response = await fetch(`/api/bilan-pallier2-maths?id=${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Diagnostic non trouvé. Vérifiez le lien.");
          } else {
            setError("Erreur lors du chargement du diagnostic.");
          }
          return;
        }
        const data = await response.json();
        setDiagnostic(data.diagnostic);

        if (data.diagnostic.analysisResult) {
          try {
            const parsed = JSON.parse(data.diagnostic.analysisResult) as ParsedBilans;
            setBilans(parsed);
          } catch {
            console.error("Failed to parse analysisResult");
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Impossible de contacter le serveur.");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchDiagnostic();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-slate-300">Chargement de votre bilan...</p>
        </div>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
            <p className="text-slate-300">{error || "Diagnostic introuvable."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scoring = diagnostic.data?.scoring;
  const isAnalyzed = diagnostic.status === "ANALYZED" && bilans;
  const isPending = diagnostic.status === "SCORED" || diagnostic.status === "PENDING";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge
            variant="outline"
            className="mb-4 border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
          >
            BILAN DIAGNOSTIC PRÉ-STAGE
          </Badge>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
            Bilan de {diagnostic.studentFirstName} {diagnostic.studentLastName}
          </h1>
          <p className="text-slate-400 text-sm">
            Soumis le{" "}
            {new Date(diagnostic.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Scoring Summary */}
        {scoring && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-slate-400 text-xs uppercase mb-1">Score de préparation</p>
                <p
                  className={`text-3xl font-bold ${
                    scoring.readinessScore >= 70
                      ? "text-green-400"
                      : scoring.readinessScore >= 50
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {scoring.readinessScore}/100
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-slate-400 text-xs uppercase mb-1">Indice de risque</p>
                <p
                  className={`text-3xl font-bold ${
                    scoring.riskIndex <= 40
                      ? "text-green-400"
                      : scoring.riskIndex <= 60
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {scoring.riskIndex}/100
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-slate-400 text-xs uppercase mb-1">Recommandation</p>
                <Badge
                  className={`text-sm ${
                    scoring.recommendation === "Pallier2_confirmed"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : scoring.recommendation === "Pallier2_conditional"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}
                  variant="outline"
                >
                  {scoring.recommendation === "Pallier2_confirmed"
                    ? "Pallier 2 confirmé"
                    : scoring.recommendation === "Pallier2_conditional"
                      ? "Pallier 2 conditionnel"
                      : "Pallier 1 recommandé"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {scoring && scoring.alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            {scoring.alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.type === "danger"
                    ? "bg-red-500/10 border-red-500/30"
                    : alert.type === "warning"
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-blue-500/10 border-blue-500/30"
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    alert.type === "danger"
                      ? "text-red-400"
                      : alert.type === "warning"
                        ? "text-yellow-400"
                        : "text-blue-400"
                  }`}
                />
                <p className="text-slate-200 text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bilans Tabs */}
        {isAnalyzed && bilans ? (
          <Tabs defaultValue="eleve" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 mb-6">
              <TabsTrigger value="eleve" className="flex items-center gap-2 data-[state=active]:bg-brand-accent/20">
                <GraduationCap className="w-4 h-4" />
                <span className="hidden sm:inline">Élève</span>
              </TabsTrigger>
              <TabsTrigger value="parents" className="flex items-center gap-2 data-[state=active]:bg-brand-accent/20">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Parents</span>
              </TabsTrigger>
              <TabsTrigger value="nexus" className="flex items-center gap-2 data-[state=active]:bg-brand-accent/20">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Nexus</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eleve">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-brand-accent" />
                    Mon Diagnostic Maths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(bilans.eleve) }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parents">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-accent" />
                    Rapport de Positionnement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(bilans.parents) }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nexus">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-brand-accent" />
                    Fiche Pédagogique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(bilans.nexus) }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : isPending ? (
          <Card className="bg-slate-800/50 border-yellow-500/30">
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Bilan en cours de génération</h2>
              <p className="text-slate-300 mb-4">
                Votre diagnostic a été enregistré et scoré. Le bilan détaillé est en cours de
                génération par notre IA. Cela peut prendre quelques minutes.
              </p>
              <p className="text-slate-400 text-sm">
                Rafraîchissez cette page dans quelques instants.
              </p>
              {scoring && (
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-slate-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-400" />
                    Score de préparation : <strong>{scoring.readinessScore}/100</strong> — {scoring.recommendationMessage}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Bilan non disponible</h2>
              <p className="text-slate-300">
                Le bilan détaillé n&apos;est pas encore disponible pour ce diagnostic.
                Statut actuel : <Badge variant="outline">{diagnostic.status}</Badge>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Domain Scores Detail */}
        {scoring && scoring.domainScores.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 mt-8">
            <CardHeader>
              <CardTitle className="text-white text-lg">Cartographie par domaine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scoring.domainScores.map((domain) => (
                  <div key={domain.domain}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-200 text-sm font-medium capitalize">
                        {domain.domain}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          domain.score >= 70
                            ? "text-green-400"
                            : domain.score >= 50
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {domain.score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          domain.score >= 70
                            ? "bg-green-500"
                            : domain.score >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.max(domain.score, 2)}%` }}
                      />
                    </div>
                    {domain.gaps.length > 0 && (
                      <p className="text-slate-400 text-xs mt-1">
                        Lacunes : {domain.gaps.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Simple markdown to HTML converter for bilan display.
 * Handles: headers, bold, italic, lists, paragraphs.
 */
function markdownToHtml(md: string): string {
  if (!md) return "<p>Contenu non disponible.</p>";

  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="text-slate-300 ml-4">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "")
    .replace(/<p><\/p>/g, "");
}
