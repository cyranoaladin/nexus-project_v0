'use client';

import React from 'react';
import {
  Calendar, CheckCircle2, Clock, BookOpen, GraduationCap,
  Layout, Target, Zap, ArrowRight, Download, FileText, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SessionPlan, WeekPlan, DiagnosticResult } from '@/lib/diagnostic/maths-terminale/types';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { RoadmapPDFDocument } from '@/lib/diagnostic/maths-terminale/pdf-generator';

interface DiagnosticRoadmapProps {
  evaluatedData: DiagnosticResult;
  sessions: SessionPlan[];
  postStagePlan: WeekPlan[];
  studentName: string;
  showExportButton?: boolean;
}


export function DiagnosticRoadmap({
  evaluatedData,
  sessions,
  postStagePlan,
  studentName,
  showExportButton = true
}: DiagnosticRoadmapProps) {
  const { calculatedProfile, globalPercentage, isProvisional } = evaluatedData;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header / Profile Summary */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-brand-dark border border-white/10 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <GraduationCap className="w-48 h-48 text-brand-accent" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <Badge className="bg-brand-accent/20 text-brand-accent border-brand-accent/30 mb-2">
                Parcours Personnalisé
              </Badge>
              <h2 className="text-3xl font-black text-white tracking-tight">
                Stratégie de Réussite Bac
              </h2>
            </div>
            {showExportButton && (
              <PDFDownloadLink
                document={
                  <RoadmapPDFDocument
                    evaluatedData={evaluatedData}
                    sessions={sessions}
                    postStagePlan={postStagePlan}
                    studentName={studentName}
                  />
                }
                fileName={`Parcours_Maths_${studentName.replace(/\s+/g, '_')}.pdf`}
              >
                {({ loading }) => (
                  <button
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-brand-accent" />}
                    {loading ? 'Génération...' : 'Exporter en PDF'}
                  </button>
                )}
              </PDFDownloadLink>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-[10px] uppercase font-black text-brand-accent mb-1 tracking-widest">Profil Diagnostiqué</div>
                <div className="text-xl font-bold text-white mb-1">{calculatedProfile.label}</div>
                <p className="text-sm text-neutral-400 leading-relaxed">{calculatedProfile.desc}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center md:justify-end">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * globalPercentage) / 100}
                      className="text-brand-accent transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-white">{globalPercentage}%</span>
                    <span className="text-[8px] uppercase font-bold text-neutral-500">Score Global</span>
                  </div>
                </div>
                {isProvisional && (
                  <p className="text-[10px] text-amber-400 mt-2 font-bold animate-pulse">
                    ⚠️ En attente de validation coach
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8-Session Intensive Stage Plan */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20">
            <Zap className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Stage Intensif : Le Parcours de 16h</h3>
            <p className="text-sm text-neutral-500">8 séances ciblées pour transformer vos fragilités en points forts.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {sessions.map((session) => (
            <Card key={session.num} className="bg-surface-card border-white/5 hover:border-brand-accent/30 transition-all group overflow-hidden">
              <CardHeader className="p-4 pb-2 relative">
                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-4xl font-black text-white">{session.num}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[8px] uppercase border-neutral-700 text-neutral-500">
                    SÉANCE {session.num}
                  </Badge>
                  <Badge className="text-[8px] uppercase bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {session.type}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors">
                  {session.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="space-y-1">
                  {session.chapters.slice(0, 2).map((chap, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                      <BookOpen className="w-3 h-3 text-neutral-600" />
                      <span className="truncate">{chap}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="text-[9px] font-bold text-neutral-600 uppercase mb-1">Objectif Clé</div>
                  <p className="text-[10px] text-neutral-300 line-clamp-2 leading-relaxed italic">
                    "{session.objectives[0]}"
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 4-Week Post-Stage Strategy */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Stratégie Post-Stage : J-30 avant le Bac</h3>
            <p className="text-sm text-neutral-500">Maintenir la dynamique et sécuriser la mention.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {postStagePlan.map((week, idx) => (
            <div 
              key={idx} 
              className="relative p-6 rounded-2xl bg-surface-card border border-white/5 flex gap-4 items-start group hover:bg-white/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <span className="text-emerald-400 font-bold text-sm">{idx + 1}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">{week.week}</span>
                  <h4 className="text-md font-bold text-white">{week.title}</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{week.desc}</p>
                {week.deliverable && (
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 bg-white/5 px-3 py-1.5 rounded-lg w-fit">
                    <FileText className="w-3 h-3 text-brand-accent" />
                    Livrable : <span className="text-neutral-300 font-bold">{week.deliverable}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology Tips / Bottom CTA */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
          <CheckCircle2 className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-lg font-bold text-white">Conseil de réussite</h4>
          <p className="text-sm text-neutral-400 max-w-2xl">
            Ce parcours est conçu mathématiquement pour optimiser votre score au Bac. La clé de la réussite réside dans la régularité des traces écrites et la reprise systématique des erreurs notées dans votre carnet d'erreurs.
          </p>
        </div>
        <PDFDownloadLink
          document={
            <RoadmapPDFDocument
              evaluatedData={evaluatedData}
              sessions={sessions}
              postStagePlan={postStagePlan}
              studentName={studentName}
            />
          }
          fileName={`Parcours_Maths_${studentName.replace(/\s+/g, '_')}.pdf`}
          className="w-full md:w-auto"
        >
          {({ loading }) => (
            <button 
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-brand-accent text-brand-dark font-black rounded-xl text-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? 'Génération...' : 'Télécharger le PDF complet'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </PDFDownloadLink>
      </div>
    </div>
  );
}
