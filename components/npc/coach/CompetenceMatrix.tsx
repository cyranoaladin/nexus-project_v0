// ═══════════════════════════════════════════════════════════════════════════════
// Competence Matrix Component
// Visual representation of skill assessment
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, BookOpen } from 'lucide-react';

interface CompetenceItem {
  name: string;
  score: number;
  maxScore: number;
  level: 'not_acquired' | 'partially_acquired' | 'acquired' | 'mastered';
  evidence: string;
  recommendations?: string[];
}

interface CompetenceBlock {
  code: string;
  name: string;
  items: CompetenceItem[];
}

interface CompetenceMatrixProps {
  matrix: { blocks: CompetenceBlock[] };
  globalScore: number;
  globalLevel: string;
}

const levelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  not_acquired: { label: 'Non acquis', color: 'text-red-600', bgColor: 'bg-red-100' },
  partially_acquired: { label: 'Partiellement acquis', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  acquired: { label: 'Acquis', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  mastered: { label: 'Maîtrisé', color: 'text-green-600', bgColor: 'bg-green-100' },
};

export function CompetenceMatrix({ matrix, globalScore, globalLevel }: CompetenceMatrixProps) {
  const level = levelConfig[globalLevel] || levelConfig.partially_acquired;

  return (
    <div className="space-y-6">
      {/* Global Score Card */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Score global</h3>
              <p className="text-sm text-gray-600 mt-1">
                Moyenne pondérée de toutes les compétences évaluées
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-indigo-600">
                {globalScore.toFixed(1)}/100
              </div>
              <Badge className={`${level.bgColor} ${level.color} mt-2`}>
                {level.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competence Blocks */}
      <div className="space-y-6">
        {matrix.blocks.map((block) => (
          <Card key={block.code}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                {block.name}
                <Badge variant="outline" className="ml-2 text-xs">
                  {block.code}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {block.items.map((item, index) => {
                  const itemLevel = levelConfig[item.level];
                  return (
                    <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            {item.score}/{item.maxScore}
                          </span>
                          <Badge className={`${itemLevel.bgColor} ${itemLevel.color} text-xs`}>
                            {itemLevel.label}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={(item.score / item.maxScore) * 100} className="h-2 mb-2" />
                      <p className="text-xs text-gray-500 italic">
                        &ldquo;{item.evidence.slice(0, 120)}...&rdquo;
                      </p>
                      {item.recommendations && item.recommendations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.recommendations.map((rec, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <Target className="h-3 w-3 mr-1" />
                              {rec}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
