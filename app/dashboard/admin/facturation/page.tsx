'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Download,
  Search,
  Filter,
  Loader2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  XCircle,
  CreditCard,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface InvoiceListItem {
  id: string;
  number: string;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  customerName: string;
  customerEmail: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  pdfUrl: string | null;
  items: Array<{
    id: string;
    label: string;
    description: string | null;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ItemFormRow {
  label: string;
  description: string;
  qty: number;
  unitPrice: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Convert millimes (from API) to TND display string */
function formatMillimes(millimes: number): string {
  return `${(millimes / 1000).toFixed(3)} TND`;
}

/** Format a TND amount (from form) for display */
function formatTnd(tnd: number): string {
  return `${tnd.toFixed(3)} TND`;
}

/** Convert TND (user input) to millimes (API) */
function toMillimes(tnd: number): number {
  return Math.round(tnd * 1000);
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'DRAFT':
      return { label: 'Brouillon', className: 'bg-neutral-700/50 text-neutral-300' };
    case 'SENT':
      return { label: 'Envoyée', className: 'bg-blue-500/20 text-blue-400' };
    case 'PAID':
      return { label: 'Payée', className: 'bg-emerald-500/20 text-emerald-400' };
    case 'CANCELLED':
      return { label: 'Annulée', className: 'bg-slate-1000/20 text-slate-300' };
    default:
      return { label: status, className: 'bg-neutral-700/50 text-neutral-400' };
  }
}

const EMPTY_ITEM: ItemFormRow = { label: '', description: '', qty: 1, unitPrice: 0 };

// ─── Canonical Payment Methods (from lib/invoice/types.ts) ──────────────────

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'BANK_TRANSFER', label: 'Virement bancaire' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'CARD', label: 'Carte bancaire' },
  { value: 'CLICTOPAY', label: 'ClicToPay' },
];

// ─── Nexus Product Presets ──────────────────────────────────────────────────

interface ProductPreset {
  label: string;
  description: string;
  unitPrice: number; // in TND (converted to millimes on send)
  category: string;
}

const NEXUS_PRESETS: ProductPreset[] = [
  { label: 'Stage Intensif Maths — Palier 2, Viser mention', description: '5 jours, 4h/jour, groupe de 6 max', unitPrice: 350, category: 'Stage' },
  { label: 'Stage Intensif Maths — Palier 1, Consolider les bases', description: '5 jours, 4h/jour, groupe de 6 max', unitPrice: 250, category: 'Stage' },
  { label: 'Stage NSI — Terminale, Prépa Bac', description: '4 jours, 3h/jour, groupe de 4 max', unitPrice: 300, category: 'Stage' },
  { label: 'Abonnement Essentiel', description: '4 séances/mois + ARIA illimité', unitPrice: 190, category: 'Abonnement' },
  { label: 'Abonnement Hybride', description: '8 séances/mois + ARIA illimité', unitPrice: 290, category: 'Abonnement' },
  { label: 'Abonnement Premium', description: '12 séances/mois + ARIA illimité + suivi coach dédié', unitPrice: 490, category: 'Abonnement' },
  { label: 'Pack 5 crédits — Séances individuelles', description: 'Valable 2 mois', unitPrice: 225, category: 'Pack' },
  { label: 'Pack 10 crédits — Séances individuelles', description: 'Valable 4 mois', unitPrice: 400, category: 'Pack' },
  { label: 'Séance individuelle Maths', description: '1h, en ligne ou présentiel', unitPrice: 55, category: 'Séance' },
  { label: 'Séance individuelle NSI', description: '1h, en ligne', unitPrice: 60, category: 'Séance' },
  { label: 'Add-on ARIA Maths', description: 'Assistant IA illimité, 1 mois', unitPrice: 35, category: 'Add-on' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function FacturationPage() {
  // List state
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<ItemFormRow[]>([{ ...EMPTY_ITEM }]);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  // ─── Fetch invoices ───────────────────────────────────────────────────

  const fetchInvoices = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/invoices?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setInvoices(data.invoices ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  // ─── Form handlers ────────────────────────────────────────────────────

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemFormRow, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function computeSubtotal(): number {
    return items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  }

  function computeTotal(): number {
    return Math.max(0, computeSubtotal() - discountTotal);
  }

  function resetForm() {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerAddress('');
    setItems([{ ...EMPTY_ITEM }]);
    setDiscountTotal(0);
    setPaymentMethod('');
    setNotes('');
    setFormError(null);
  }

  function addPreset(preset: ProductPreset) {
    setItems((prev) => [
      ...prev.filter((item) => item.label.trim() !== ''),
      { label: preset.label, description: preset.description, qty: 1, unitPrice: preset.unitPrice },
    ]);
  }

  function validateForm(): string | null {
    if (!customerName.trim()) return 'Le nom du client est requis.';

    const validItems = items.filter((item) => item.label.trim());
    if (validItems.length === 0) return 'Au moins un article est requis.';

    for (let i = 0; i < validItems.length; i++) {
      if (validItems[i].qty < 1) return `Article ${i + 1} : la quantité doit être >= 1.`;
      if (validItems[i].unitPrice < 0) return `Article ${i + 1} : le prix unitaire ne peut pas être négatif.`;
    }

    if (discountTotal < 0) return 'La remise ne peut pas être négative.';
    if (discountTotal > computeSubtotal()) return 'La remise ne peut pas dépasser le sous-total.';

    return null;
  }

  function handleShowPreview() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setShowPreview(true);
  }

  async function handleCreate() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);

    setCreating(true);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim() || null,
            address: customerAddress.trim() || null,
          },
          items: items
            .filter((item) => item.label.trim())
            .map((item) => ({
              label: item.label.trim(),
              description: item.description.trim() || null,
              qty: item.qty,
              unitPrice: toMillimes(item.unitPrice), // TND → millimes
            })),
          discountTotal: discountTotal > 0 ? toMillimes(discountTotal) : undefined, // TND → millimes
          paymentMethod: paymentMethod || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? err.details ?? 'Erreur lors de la création.');
        return;
      }

      const result = await res.json();

      // Open PDF in new tab
      if (result.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
      }

      resetForm();
      setShowForm(false);
      fetchInvoices(1);
    } catch {
      setFormError('Erreur réseau. Réessayez.');
    } finally {
      setCreating(false);
    }
  }

  // ─── Status action handlers ──────────────────────────────────────────

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState<InvoiceListItem | null>(null);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payReference, setPayReference] = useState('');

  async function handleStatusAction(
    invoiceId: string,
    action: 'MARK_SENT' | 'MARK_PAID' | 'CANCEL',
    meta?: Record<string, unknown>
  ) {
    setActionLoading(invoiceId);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, meta }),
      });
      if (!res.ok) {
        const err = await res.json();
        setActionError(err.error ?? 'Erreur lors de la mise à jour.');
        return;
      }
      fetchInvoices(pagination.page);
    } catch {
      setActionError('Erreur réseau.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleMarkSent(inv: InvoiceListItem) {
    handleStatusAction(inv.id, 'MARK_SENT');
  }

  function handleCancel(inv: InvoiceListItem) {
    if (!confirm(`Annuler la facture ${inv.number} ?`)) return;
    handleStatusAction(inv.id, 'CANCEL', { reason: 'Annulation manuelle' });
  }

  function handleOpenPayModal(inv: InvoiceListItem) {
    setShowPayModal(inv);
    setPayMethod('CASH');
    setPayReference('');
    setActionError(null);
  }

  function handleConfirmPaid() {
    if (!showPayModal) return;
    handleStatusAction(showPayModal.id, 'MARK_PAID', {
      payment: {
        method: payMethod,
        reference: payReference.trim() || null,
        amountPaid: showPayModal.total,
      },
    });
    setShowPayModal(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">Facturation</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestion des factures — Création, suivi, téléchargement.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Rechercher par client ou numéro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-neutral-700 bg-surface-card text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 text-sm rounded-lg border border-neutral-700 bg-surface-card text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50 appearance-none"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SENT">Envoyée</option>
            <option value="PAID">Payée</option>
            <option value="CANCELLED">Annulée</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="rounded-xl border border-neutral-800/50 bg-surface-card/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <FileText className="h-10 w-10 mb-3 text-neutral-700" />
            <p className="text-sm">Aucune facture trouvée.</p>
            <p className="text-xs text-neutral-600 mt-1">
              Créez votre première facture pour commencer.
            </p>
          </div>
        ) : (
          <>
            {/* Action error banner */}
            {actionError && (
              <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-slate-1000/10 border border-slate-500/20 text-slate-300 text-xs">
                {actionError}
              </div>
            )}

            {/* Table header */}
            <div className="grid grid-cols-[1fr_110px_90px_90px_160px] gap-3 px-5 py-3 border-b border-neutral-800/50 text-xs font-medium uppercase tracking-wider text-neutral-500">
              <span>Client / N°</span>
              <span>Date</span>
              <span className="text-right">Total</span>
              <span className="text-center">Statut</span>
              <span className="text-center">Actions</span>
            </div>

            {/* Table rows */}
            {invoices.map((inv) => {
              const badge = getStatusBadge(inv.status);
              const isLoading = actionLoading === inv.id;
              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-[1fr_110px_90px_90px_160px] gap-3 px-5 py-3 border-b border-neutral-800/30 hover:bg-neutral-800/20 transition-colors items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate">{inv.customerName}</p>
                    <p className="text-xs text-neutral-500">{inv.number}</p>
                  </div>
                  <span className="text-xs text-neutral-400">{formatDate(inv.issuedAt)}</span>
                  <span className="text-sm font-medium text-neutral-200 text-right">
                    {formatMillimes(inv.total)}
                  </span>
                  <div className="flex justify-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {/* PDF download */}
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-neutral-700/50 text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="Télécharger PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {/* Contextual status actions */}
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                    ) : (
                      <>
                        {inv.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleMarkSent(inv)}
                              className="p-1.5 rounded-md hover:bg-blue-500/10 text-blue-400/70 hover:text-blue-400 transition-colors"
                              title="Marquer envoyée"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancel(inv)}
                              className="p-1.5 rounded-md hover:bg-slate-1000/10 text-neutral-500 hover:text-slate-300 transition-colors"
                              title="Annuler"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {inv.status === 'SENT' && (
                          <>
                            <button
                              onClick={() => handleOpenPayModal(inv)}
                              className="p-1.5 rounded-md hover:bg-green-500/10 text-green-400/70 hover:text-green-400 transition-colors"
                              title="Marquer payée"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancel(inv)}
                              className="p-1.5 rounded-md hover:bg-slate-1000/10 text-neutral-500 hover:text-slate-300 transition-colors"
                              title="Annuler"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {inv.status === 'PAID' && (
                          <span className="text-[10px] text-green-500/60 font-medium">Payée</span>
                        )}
                        {inv.status === 'CANCELLED' && (
                          <span className="text-[10px] text-neutral-600 font-medium">Annulée</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-neutral-500">
                  {pagination.total} facture{pagination.total > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchInvoices(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-1.5 rounded-md border border-neutral-700 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-neutral-400">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchInvoices(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-1.5 rounded-md border border-neutral-700 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Create Invoice Modal ──────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-surface-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-100">Nouvelle facture</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-md hover:bg-neutral-700/50 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-slate-1000/10 border border-slate-500/20 text-sm text-slate-300">
                {formError}
              </div>
            )}

            {/* Customer */}
            <fieldset className="mb-6">
              <legend className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                Client
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nom complet du client"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Adresse du client"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  />
                </div>
              </div>
            </fieldset>

            {/* Nexus Product Presets */}
            <fieldset className="mb-6">
              <legend className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                Produits Nexus (ajout rapide)
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {NEXUS_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addPreset(preset)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-neutral-700/50 bg-neutral-800/30 text-neutral-400 hover:text-neutral-200 hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
                    title={`${preset.description} — ${preset.unitPrice} TND`}
                  >
                    <span className="text-neutral-600">{preset.category}</span>
                    <span className="truncate max-w-[180px]">{preset.label.split(' — ')[0]}</span>
                    <span className="text-brand-primary/70 font-medium">{preset.unitPrice} TND</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-neutral-600">
                Prix en TND. Arrondi au millime (0,001 TND). La conversion est automatique.
              </p>
            </fieldset>

            {/* Items */}
            <fieldset className="mb-6">
              <legend className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                Articles
              </legend>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_60px_90px_32px] gap-2 items-start">
                    <div>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateItem(index, 'label', e.target.value)}
                        placeholder="Désignation"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-700/50 bg-neutral-800/30 text-neutral-400 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                      className="px-2 py-2 text-sm text-center rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                      title="Quantité"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="px-2 py-2 text-sm text-right rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                      title="Prix unitaire (TND)"
                    />
                    <button
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="p-2 rounded-lg text-neutral-500 hover:text-slate-300 hover:bg-slate-1000/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addItem}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Ajouter un article
              </button>
            </fieldset>

            {/* Discount + Payment */}
            <fieldset className="mb-6">
              <legend className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                Conditions
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Remise (TND)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discountTotal}
                    onChange={(e) => setDiscountTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Mode de paiement</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                  >
                    <option value="">Non spécifié</option>
                    <option value="CASH">Espèces</option>
                    <option value="BANK_TRANSFER">Virement bancaire</option>
                    <option value="CLICTOPAY">ClicToPay</option>
                    <option value="CHECK">Chèque</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Notes internes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes internes (non imprimées sur la facture)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50 resize-none"
                  />
                </div>
              </div>
            </fieldset>

            {/* Summary */}
            <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-4 mb-6">
              <div className="flex justify-between text-sm text-neutral-400 mb-1">
                <span>Sous-total</span>
                <span>{formatTnd(computeSubtotal())}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-400 mb-1">
                  <span>Remise</span>
                  <span>-{formatTnd(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-neutral-100 pt-2 border-t border-neutral-700/50 mt-2">
                <span>Total</span>
                <span>{formatTnd(computeTotal())}</span>
              </div>
            </div>

            {/* Preview Panel */}
            {showPreview && (
              <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-4 mb-6">
                <h3 className="text-xs font-medium uppercase tracking-wider text-brand-primary mb-3">
                  Aperçu avant génération
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Client</span>
                    <span className="text-neutral-200 font-medium">{customerName}</span>
                  </div>
                  {customerEmail && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Email</span>
                      <span className="text-neutral-300">{customerEmail}</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-700/30 my-2" />
                  {items.filter(i => i.label.trim()).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-neutral-300 truncate max-w-[60%]">
                        {item.qty > 1 ? `${item.qty}x ` : ''}{item.label}
                      </span>
                      <span className="text-neutral-200">{formatTnd(item.qty * item.unitPrice)}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-700/30 my-2" />
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral-300">Total</span>
                    <span className="text-neutral-100">{formatTnd(computeTotal())}</span>
                  </div>
                  {paymentMethod && (
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Paiement</span>
                      <span className="text-neutral-300">{paymentMethod}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setShowPreview(false); }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 transition-colors"
              >
                Annuler
              </button>
              {!showPreview ? (
                <button
                  onClick={handleShowPreview}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg border border-brand-primary text-brand-primary hover:bg-brand-primary/10 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  Aperçu
                </button>
              ) : (
              <button
                onClick={() => { setShowPreview(false); handleCreate(); }}
                disabled={creating}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Générer la facture
                  </>
                )}
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Marquer payée ──────────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700/50 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-neutral-100">Marquer comme payée</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Facture {showPayModal.number} — {formatMillimes(showPayModal.total)}
              </p>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Mode de paiement *
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700/50 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
              >
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Référence (optionnel)
              </label>
              <input
                type="text"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="N° virement, N° chèque..."
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700/50 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
              />
            </div>

            {/* Amount (read-only, pre-filled) */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Montant payé
              </label>
              <div className="w-full px-3 py-2 rounded-lg bg-neutral-800/50 border border-neutral-700/30 text-sm text-neutral-300">
                {formatMillimes(showPayModal.total)}
                <span className="text-[10px] text-neutral-600 ml-2">Le montant est fixé au total de la facture (paiement complet).</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPayModal(null)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmPaid}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Confirmer le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
