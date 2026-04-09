'use client';

import React from 'react';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import { resolveUiIcon } from '@/lib/ui-icons';

interface MaterialCategory {
  title: string;
  icon: string;
  items: string[];
  note?: string;
}

interface SubjectMaterials {
  subject: string;
  icon: string;
  description: string;
  categories: MaterialCategory[];
}

interface RequiredMaterialsProps {
  materials: SubjectMaterials[];
}

export function RequiredMaterials({ materials }: RequiredMaterialsProps) {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Matériel requis
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              Ce dont votre enfant aura besoin pour réussir le stage
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {materials.map((subjectMaterial, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl shadow-xl p-8 border-2 border-slate-200 hover:border-blue-400 transition-all"
              >
                <div className="flex items-center gap-4 mb-6">
                  {(() => {
                    const SubjectIcon = resolveUiIcon(subjectMaterial.icon);
                    return (
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
                        <SubjectIcon className="h-8 w-8" aria-hidden="true" />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{subjectMaterial.subject}</h3>
                    <p className="text-sm text-slate-600">{subjectMaterial.description}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {subjectMaterial.categories.map((category, catIdx) => (
                    <div key={catIdx} className="bg-slate-50 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        {(() => {
                          const CategoryIcon = resolveUiIcon(category.icon);
                          return (
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                              <CategoryIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          );
                        })()}
                        <h4 className="font-bold text-slate-900">{category.title}</h4>
                      </div>

                      <ul className="space-y-2">
                        {category.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-blue-600 font-bold mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      {category.note && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                          <p className="text-xs text-slate-700 flex items-start gap-2">
                            <Lightbulb className="mt-0.5 h-4 w-4 text-blue-600" aria-hidden="true" />
                            <span>{category.note}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl border-2 border-green-200">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-700" aria-hidden="true" />
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Tout est fourni par Nexus Réussite</h4>
                <p className="text-sm text-slate-700">
                  Supports de cours, exercices, corrections détaillées et accès aux ressources numériques
                  sont inclus dans le prix du stage. L'élève n'a besoin que du matériel de base listé ci-dessus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
