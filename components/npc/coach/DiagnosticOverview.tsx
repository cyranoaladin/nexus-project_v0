// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic Overview Component
// Summary, strengths, weaknesses, and recommendations
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Target,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface Strength {
  title: string;
  description: string;
  evidence: string;
}

interface Weakness {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
}

interface DiagnosticOverviewProps {
  summary: string;
  overallLevel: string;
  confidenceScore: number;
  strengths: Strength[];
  weaknesses: Weakness[];
  recommendations: string[];
}

const levelLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  beginner: { label: 'Débutant', color: 'text-red-600', bgColor: 'bg-red-100' },
  developing: { label: 'En développement', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  proficient: { label: 'Compétent', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  advanced: { label: 'Avancé', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  expert: { label: 'Expert', color: 'text-green-600', bgColor: 'bg-green-100' },
};

const severityConfig: Record<string, { label: string; icon: typeof AlertCircle; color: string }> = {
  low: { label: 'Faible', icon: CheckCircle2, color: 'text-yellow-600 bg-yellow-100' },
  medium: { label: 'Moyen', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
  high: { label: 'Élevé', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  critical: { label: 'Critique', icon: XCircle, color: 'text-red-800 bg-red-200' },
};

export function DiagnosticOverview({
  summary,
  overallLevel,
  confidenceScore,
  strengths,
  weaknesses,
  recommendations,
}: DiagnosticOverviewProps) {
  const level = levelLabels[overallLevel] || levelLabels.developing;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Synthèse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{summary}</p>
          <div className="mt-4 flex items-center gap-4">
            <Badge className={`${level.bgColor} ${level.color} text-sm`}>
              Niveau : {level.label}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Confiance IA:</span>
              <Progress value={confidenceScore * 100} className="w-24 h-2" />
              <span>{Math.round(confidenceScore * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strengths & Weaknesses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <TrendingUp className="h-5 w-5" />
              Points forts ({strengths.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {strengths.map((strength, index) => (
                <div key={index} className="border-l-4 border-green-400 pl-4">
                  <h4 className="font-semibold text-gray-900">{strength.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{strength.description}</p>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    &ldquo;{strength.evidence.slice(0, 100)}...&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Target className="h-5 w-5" />
              Points à travailler ({weaknesses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weaknesses.map((weakness, index) => {
                const severity = severityConfig[weakness.severity];
                const Icon = severity.icon;
                return (
                  <div key={index} className="border-l-4 border-orange-400 pl-4">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-gray-900">{weakness.title}</h4>
                      <Badge className={`${severity.color} text-xs`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {severity.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{weakness.description}</p>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      &ldquo;{weakness.evidence.slice(0, 100)}...&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            Recommandations prioritaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
