'use client';

import React from 'react';
import { Brain, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';

interface ScoreHeaderProps {
  globalScore: number;
  confidenceIndex: number;
  precisionIndex: number;
  diagnosticText: string;
  lucidityText: string;
  totalQuestions: number;
  totalAttempted: number;
  totalCorrect: number;
  totalNSP: number;
  studentName?: string;
}

function CircularGauge({ value, size = 160, strokeWidth = 12 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  const getColor = (v: number) => {
    if (v >= 70) return { stroke: '#2563eb', bg: 'text-blue-700', label: 'bg-blue-50' };
    if (v >= 50) return { stroke: '#6b86a3', bg: 'text-blue-600', label: 'bg-slate-50' };
    if (v >= 30) return { stroke: '#64748b', bg: 'text-slate-700', label: 'bg-slate-100' };
    return { stroke: '#334155', bg: 'text-slate-800', label: 'bg-slate-200' };
  };

  const colors = getColor(value);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black ${colors.bg}`}>{Math.round(value)}</span>
        <span className="text-xs text-slate-500 font-medium">/100</span>
      </div>
    </div>
  );
}

function ConfidenceProfile({ confidenceIndex }: { confidenceIndex: number }) {
  if (confidenceIndex >= 80) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-bold text-blue-700">Profil Lucide</span>
        <span className="text-xs text-blue-600">({Math.round(confidenceIndex)}% de confiance)</span>
      </div>
    );
  }
  if (confidenceIndex >= 50) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
        <TrendingUp className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-bold text-blue-700">Profil Engagé</span>
        <span className="text-xs text-blue-600">({Math.round(confidenceIndex)}% de confiance)</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded-full">
      <AlertTriangle className="w-4 h-4 text-slate-600" />
      <span className="text-sm font-bold text-slate-700">Profil Hésitant</span>
      <span className="text-xs text-slate-600">({Math.round(confidenceIndex)}% de confiance)</span>
    </div>
  );
}

export default function ScoreHeader({
  globalScore,
  confidenceIndex,
  precisionIndex,
  diagnosticText,
  lucidityText,
  totalQuestions,
  totalAttempted,
  totalCorrect,
  totalNSP,
  studentName,
}: ScoreHeaderProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">
          Bilan de Positionnement
        </h1>
        {studentName && (
          <p className="text-lg text-slate-600">{studentName}</p>
        )}
        <p className="text-sm text-slate-500">Stage Février 2026 — Maths & NSI</p>
      </div>

      {/* Score + Metrics */}
      <div className="flex flex-col sm:flex-row items-center gap-8 mb-6">
        {/* Circular Gauge */}
        <div className="flex-shrink-0">
          <CircularGauge value={globalScore} />
        </div>

        {/* Metrics Grid */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-900">{totalAttempted}</p>
              <p className="text-[10px] text-slate-500 uppercase font-medium">Tentées</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-700">{totalCorrect}</p>
              <p className="text-[10px] text-blue-600 uppercase font-medium">Correctes</p>
            </div>
            <div className="bg-slate-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-700">{totalAttempted - totalCorrect}</p>
              <p className="text-[10px] text-slate-600 uppercase font-medium">Erreurs</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-slate-600">{totalNSP}</p>
              <p className="text-[10px] text-slate-500 uppercase font-medium">Non vues</p>
            </div>
          </div>

          {/* Precision bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-medium">Précision (parmi les tentées)</span>
              <span className="font-bold text-slate-700">{Math.round(precisionIndex)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${precisionIndex}%` }}
              />
            </div>
          </div>

          {/* Confidence Profile */}
          <div className="flex justify-center sm:justify-start">
            <ConfidenceProfile confidenceIndex={confidenceIndex} />
          </div>
        </div>
      </div>

      {/* Diagnostic Text */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-5 border border-slate-100">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-1">Synthèse du diagnostic</p>
            <p className="text-sm text-slate-700 leading-relaxed">{diagnosticText}</p>
            {lucidityText && (
              <p className="text-xs text-slate-500 mt-2 italic">{lucidityText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
