// ═══════════════════════════════════════════════════════════════════════════════
// Mentor Advice Component
// Custom coach advice and learning tips
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, CheckSquare, TrendingUp, Sparkles } from 'lucide-react';

interface MentorAdviceProps {
  advice?: {
    personalizedAdvice: string;
    motivationMessage: string;
    studyTips: string[];
    nextSteps: string[];
    encouragement: string;
  };
}

export function MentorAdvice({ advice }: MentorAdviceProps) {
  if (!advice) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">Aucun conseil pour le moment</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Motivation Message & Encouragement */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Le mot du mentor</h3>
              <p className="text-gray-700 mt-2 italic">&quot;{advice.motivationMessage}&quot;</p>
              {advice.encouragement && (
                <p className="text-gray-600 mt-2 text-sm">{advice.encouragement}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personalized Advice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            Conseils personnalisés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 whitespace-pre-line leading-relaxed">
            {advice.personalizedAdvice}
          </p>
        </CardContent>
      </Card>

      {/* Study Tips & Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Study Tips */}
        {advice.studyTips && advice.studyTips.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-green-500" />
                Conseils méthodologiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                {advice.studyTips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {advice.nextSteps && advice.nextSteps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                Prochaines étapes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                {advice.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
