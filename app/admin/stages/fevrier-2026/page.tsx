'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  DollarSign,
  Building2,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Shield,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reservation {
  id: string;
  parentName: string;
  studentName: string | null;
  email: string;
  phone: string;
  classe: string;
  academyId: string;
  academyTitle: string;
  price: number;
  paymentMethod: string | null;
  status: string;
  scoringResult: Record<string, unknown> | null;
  telegramSent: boolean;
  createdAt: string;
}

interface AcademyStats {
  academyId: string;
  academyTitle: string;
  count: number;
  revenue: number;
}

type SortField = 'createdAt' | 'parentName' | 'academyTitle' | 'status' | 'price';
type SortDirection = 'asc' | 'desc';

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PENDING: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock className="w-3 h-3" /> },
    CONFIRMED: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
    PAID: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <DollarSign className="w-3 h-3" /> },
    CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-800', icon: <X className="w-3 h-3" /> },
  };
  const c = config[status] || config.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.icon}
      {status}
    </span>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Détails Réservation</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Parent</p>
              <p className="text-sm font-semibold text-slate-900">{reservation.parentName}</p>
            </div>
            {reservation.studentName && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Élève</p>
                <p className="text-sm font-semibold text-slate-900">{reservation.studentName}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Email</p>
              <p className="text-sm text-slate-700">{reservation.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Téléphone</p>
              <p className="text-sm text-slate-700">{reservation.phone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Classe</p>
              <p className="text-sm text-slate-700">{reservation.classe}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Académie</p>
              <p className="text-sm text-slate-700">{reservation.academyTitle}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Prix</p>
              <p className="text-sm font-bold text-blue-600">{reservation.price} TND</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Paiement</p>
              <p className="text-sm text-slate-700">{reservation.paymentMethod || 'Non spécifié'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Statut</p>
              <StatusBadge status={reservation.status} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Telegram</p>
              <p className="text-sm text-slate-700">{reservation.telegramSent ? '✅ Envoyé' : '❌ Non envoyé'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-slate-500 uppercase">Date d&apos;inscription</p>
              <p className="text-sm text-slate-700">
                {new Date(reservation.createdAt).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {reservation.scoringResult && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Résultat Scoring</p>
              <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(reservation.scoringResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-black transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(reservations: Reservation[]) {
  const headers = [
    'Date',
    'Nom Parent',
    'Nom Élève',
    'Email',
    'Téléphone',
    'Classe',
    'Académie',
    'Prix (TND)',
    'Paiement',
    'Statut',
    'Telegram',
  ];

  const rows = reservations.map((r) => [
    new Date(r.createdAt).toLocaleDateString('fr-FR'),
    r.parentName,
    r.studentName || '',
    r.email,
    r.phone,
    r.classe,
    r.academyTitle,
    String(r.price),
    r.paymentMethod || '',
    r.status,
    r.telegramSent ? 'Oui' : 'Non',
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')
    ),
  ].join('\n');

  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reservations-stage-fevrier-2026_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminStagesFevrier2026Page() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [academyFilter, setAcademyFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Modal
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // ─── Auth Guard ──────────────────────────────────────────────────────────

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'ASSISTANTE';

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [authStatus, router]);

  // ─── Fetch Data ──────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/reservation');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReservations();
    }
  }, [isAdmin, fetchReservations]);

  // ─── Computed Data ───────────────────────────────────────────────────────

  const filteredReservations = useMemo(() => {
    let result = [...reservations];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.parentName.toLowerCase().includes(q) ||
          (r.studentName && r.studentName.toLowerCase().includes(q)) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.classe.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Academy filter
    if (academyFilter !== 'all') {
      result = result.filter((r) => r.academyId === academyFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'parentName':
          cmp = a.parentName.localeCompare(b.parentName);
          break;
        case 'academyTitle':
          cmp = a.academyTitle.localeCompare(b.academyTitle);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'price':
          cmp = a.price - b.price;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [reservations, searchQuery, statusFilter, academyFilter, sortField, sortDirection]);

  const kpis = useMemo(() => {
    const total = reservations.length;
    const revenue = reservations.reduce((sum, r) => sum + r.price, 0);
    const confirmed = reservations.filter((r) => r.status === 'CONFIRMED' || r.status === 'PAID').length;
    const pending = reservations.filter((r) => r.status === 'PENDING').length;

    // Academy breakdown
    const academyMap = new Map<string, AcademyStats>();
    for (const r of reservations) {
      const existing = academyMap.get(r.academyId);
      if (existing) {
        existing.count++;
        existing.revenue += r.price;
      } else {
        academyMap.set(r.academyId, {
          academyId: r.academyId,
          academyTitle: r.academyTitle,
          count: 1,
          revenue: r.price,
        });
      }
    }
    const academies = Array.from(academyMap.values()).sort((a, b) => b.count - a.count);

    return { total, revenue, confirmed, pending, academies };
  }, [reservations]);

  const uniqueStatuses = useMemo(
    () => [...new Set(reservations.map((r) => r.status))],
    [reservations]
  );

  const uniqueAcademies = useMemo(
    () =>
      [...new Map(reservations.map((r) => [r.academyId, r.academyTitle])).entries()].map(
        ([id, title]) => ({ id, title })
      ),
    [reservations]
  );

  // ─── Sort Handler ────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-400" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-600" />
    );
  };

  // ─── Auth Loading / Denied ───────────────────────────────────────────────

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
          <Shield className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Accès Refusé</h1>
          <p className="text-slate-600 mb-6">
            Cette page est réservée aux administrateurs Nexus Réussite.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-black transition-colors"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Stage Février 2026
              </h1>
              <p className="text-sm text-slate-500">
                Dashboard Admin — Pilotage des inscriptions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchReservations}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              <button
                onClick={() => exportToCSV(filteredReservations)}
                disabled={filteredReservations.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <p className="text-sm text-slate-700">{error}</p>
            <button
              onClick={fetchReservations}
              className="ml-auto text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Total Inscrits"
            value={kpis.total}
            subtitle={`${kpis.pending} en attente`}
            icon={<Users className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50"
          />
          <KPICard
            title="CA Estimé"
            value={`${kpis.revenue.toLocaleString('fr-FR')} TND`}
            subtitle={`${kpis.confirmed} confirmé(s)`}
            icon={<DollarSign className="w-6 h-6 text-green-600" />}
            color="bg-green-50"
          />
          <KPICard
            title="Académies"
            value={kpis.academies.length}
            subtitle="avec inscriptions"
            icon={<Building2 className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50"
          />
          <KPICard
            title="Taux Confirmation"
            value={kpis.total > 0 ? `${Math.round((kpis.confirmed / kpis.total) * 100)}%` : '—'}
            subtitle={`${kpis.confirmed}/${kpis.total}`}
            icon={<CheckCircle className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50"
          />
        </div>

        {/* Academy Breakdown */}
        {kpis.academies.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Répartition par Académie</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kpis.academies.map((a) => (
                <div
                  key={a.academyId}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.academyTitle}</p>
                    <p className="text-xs text-slate-500">{a.count} inscrit(s)</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600">{a.revenue.toLocaleString('fr-FR')} TND</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher (nom, email, tél, classe)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="all">Tous les statuts</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={academyFilter}
              onChange={(e) => setAcademyFilter(e.target.value)}
              className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="all">Toutes les académies</option>
              {uniqueAcademies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Date <SortIcon field="createdAt" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('parentName')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Nom <SortIcon field="parentName" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Tél</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Classe</th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('academyTitle')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Académie <SortIcon field="academyTitle" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('price')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Prix <SortIcon field="price" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Statut <SortIcon field="status" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Score / Confiance</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="text-sm text-slate-500">Chargement des inscriptions...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        {reservations.length === 0
                          ? 'Aucune inscription pour le moment.'
                          : 'Aucun résultat pour ces filtres.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{r.parentName}</p>
                        {r.studentName && (
                          <p className="text-xs text-slate-500">{r.studentName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.email}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.phone}</td>
                      <td className="px-4 py-3 text-slate-600">{r.classe}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium max-w-[200px] truncate">
                        {r.academyTitle}
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-600 whitespace-nowrap">
                        {r.price} TND
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        {r.scoringResult ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-slate-900">
                              {Math.round((r.scoringResult as { globalScore?: number }).globalScore || 0)}/100
                            </span>
                            <span className="text-xs text-slate-500">
                              {Math.round((r.scoringResult as { confidenceIndex?: number }).confidenceIndex || 0)}% conf.
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Non passé</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedReservation(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filteredReservations.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>
                {filteredReservations.length} résultat(s)
                {filteredReservations.length !== reservations.length &&
                  ` sur ${reservations.length} total`}
              </span>
              <span>
                Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedReservation && (
        <DetailModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}
