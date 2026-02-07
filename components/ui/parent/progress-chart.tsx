"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, subMonths, isAfter } from "date-fns"
import { fr } from "date-fns/locale"
import { TrendingUp, BarChart3 } from "lucide-react"

interface ProgressDataPoint {
  date: string;
  progress: number;
  completedSessions: number;
  totalSessions: number;
}

interface SubjectProgressDataPoint {
  subject: string;
  progress: number;
  completedSessions: number;
  totalSessions: number;
}

interface ProgressChartProps {
  progressHistory: ProgressDataPoint[];
  subjectProgressHistory: SubjectProgressDataPoint[];
}

type TimeRange = "1M" | "3M" | "6M" | "1Y";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1M", label: "1 mois" },
  { value: "3M", label: "3 mois" },
  { value: "6M", label: "6 mois" },
  { value: "1Y", label: "1 an" },
];

const SUBJECT_COLORS: Record<string, string> = {
  "Mathématiques": "#2563EB",
  "Français": "#10B981",
  "Anglais": "#8B5CF6",
  "Sciences": "#F59E0B",
  "Histoire": "#EF4444",
  "Géographie": "#06B6D4",
  "default": "#6B7280"
};

function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
}

export function ProgressChart({ progressHistory, subjectProgressHistory }: ProgressChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("3M");
  const [chartType, setChartType] = React.useState<"trend" | "subjects">("trend");

  const filteredProgressHistory = React.useMemo(() => {
    if (progressHistory.length === 0) return [];

    const now = new Date();
    const monthsToSubtract = timeRange === "1M" ? 1 : timeRange === "3M" ? 3 : timeRange === "6M" ? 6 : 12;
    const startDate = subMonths(now, monthsToSubtract);

    return progressHistory.filter(point => {
      const pointDate = new Date(point.date);
      return isAfter(pointDate, startDate);
    });
  }, [progressHistory, timeRange]);

  const formattedProgressData = React.useMemo(() => {
    return filteredProgressHistory.map(point => ({
      ...point,
      formattedDate: format(new Date(point.date), "dd MMM", { locale: fr })
    }));
  }, [filteredProgressHistory]);

  const hasProgressData = progressHistory.length > 0;
  const hasSubjectData = subjectProgressHistory.length > 0;

  const CustomTooltip = React.useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg p-3" data-testid="custom-tooltip">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-neutral-600">
                {entry.name}: <span className="font-semibold">{entry.value}%</span>
              </span>
            </div>
          ))}
          {payload[0]?.payload?.completedSessions !== undefined && (
            <p className="text-xs text-neutral-500 mt-1">
              {payload[0].payload.completedSessions}/{payload[0].payload.totalSessions} séances
            </p>
          )}
        </div>
      );
    }
    return null;
  }, []);

  const SubjectTooltip = React.useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg p-3" data-testid="subject-tooltip">
          <p className="font-medium text-sm mb-2">{label}</p>
          <p className="text-sm text-neutral-600">
            Progression: <span className="font-semibold">{payload[0].value}%</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {payload[0].payload.completedSessions}/{payload[0].payload.totalSessions} séances complétées
          </p>
        </div>
      );
    }
    return null;
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            <div>
              <CardTitle>Évolution de la Progression</CardTitle>
              <CardDescription>
                Suivi des progrès au fil du temps
              </CardDescription>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Select value={chartType} onValueChange={(value) => setChartType(value as "trend" | "subjects")}>
              <SelectTrigger className="w-[140px] h-10" aria-label="Type de graphique">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trend">Tendance</SelectItem>
                <SelectItem value="subjects">Par Matière</SelectItem>
              </SelectContent>
            </Select>

            {chartType === "trend" && (
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger className="w-[120px] h-10" aria-label="Période d'affichage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {chartType === "trend" ? (
          hasProgressData && formattedProgressData.length > 0 ? (
            <div role="img" aria-label="Graphique d'évolution de la progression au fil du temps">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={formattedProgressData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="#6B7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    style={{ fontSize: '12px' }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="progress" 
                    stroke="#2563EB" 
                    strokeWidth={3}
                    dot={{ fill: "#2563EB", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Progression"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
                <TrendingUp className="w-8 h-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium mb-1">
                Aucune donnée de progression
              </p>
              <p className="text-sm text-neutral-500">
                Les données apparaîtront après les premières séances
              </p>
            </div>
          )
        ) : (
          hasSubjectData ? (
            <div role="img" aria-label="Graphique de progression par matière">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={subjectProgressHistory} 
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="subject" 
                    stroke="#6B7280"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    style={{ fontSize: '12px' }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<SubjectTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="rect"
                  />
                  <Bar 
                    dataKey="progress" 
                    name="Progression par matière"
                    radius={[8, 8, 0, 0]}
                  >
                    {subjectProgressHistory.map((entry, index) => (
                      <rect 
                        key={`cell-${index}`} 
                        fill={getSubjectColor(entry.subject)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
                <BarChart3 className="w-8 h-8 text-neutral-400" />
              </div>
              <p className="text-neutral-600 font-medium mb-1">
                Aucune donnée par matière
              </p>
              <p className="text-sm text-neutral-500">
                Les statistiques par matière apparaîtront après les premières séances
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
