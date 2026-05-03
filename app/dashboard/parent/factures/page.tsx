import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Receipt, Download, FileText, ArrowLeft, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { millimesToDisplay } from '@/lib/invoice/types';

export const metadata = {
  title: 'Mes factures | Nexus Réussite',
  description: 'Téléchargez vos factures et reçus de paiement.',
};

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PAID: { label: 'Payée', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  SENT: { label: 'À régler', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: Clock },
  ISSUED: { label: 'Émise', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: Clock },
  DRAFT: { label: 'Brouillon', color: 'text-slate-700 bg-slate-50 border-slate-200', icon: FileText },
  CANCELLED: { label: 'Annulée', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: XCircle },
  OVERDUE: { label: 'En retard', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertCircle },
};

export default async function ParentInvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin');
  if (session.user.role !== 'PARENT') redirect('/dashboard');

  const email = session.user.email ?? '';

  const invoices = await prisma.invoice.findMany({
    where: { customerEmail: email },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      number: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      paidAt: true,
      total: true,
      currency: true,
      pdfPath: true,
    },
  });

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard/parent"
          className="inline-flex items-center gap-2 mb-6 text-sm text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Receipt className="w-8 h-8 text-brand-accent" />
          <div>
            <h1 className="text-2xl font-bold text-white">Mes factures</h1>
            <p className="text-sm text-neutral-400">
              Téléchargez vos factures officielles et reçus de paiement (PDF).
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-surface-card border border-white/10 rounded-xl p-8 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-neutral-500" />
            <p className="text-neutral-300">Aucune facture disponible pour le moment.</p>
            <p className="text-sm text-neutral-500 mt-1">
              Les factures apparaîtront ici dès leur émission.
            </p>
          </div>
        ) : (
          <div className="bg-surface-card border border-white/10 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <div className="col-span-3">Numéro</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Statut</div>
              <div className="col-span-2 text-right">Montant</div>
              <div className="col-span-3 text-right">Téléchargements</div>
            </div>

            <ul className="divide-y divide-white/5">
              {invoices.map((inv) => {
                const meta = STATUS_META[inv.status] ?? STATUS_META.DRAFT;
                const Icon = meta.icon;
                const totalDisplay = millimesToDisplay(inv.total);
                const canDownloadInvoice = !!inv.pdfPath;
                const canDownloadReceipt = inv.status === 'PAID' && !!inv.paidAt;

                return (
                  <li key={inv.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                    <div className="col-span-12 md:col-span-3">
                      <p className="font-bold text-white">{inv.number}</p>
                    </div>
                    <div className="col-span-6 md:col-span-2 text-sm text-neutral-300">
                      {format(new Date(inv.issuedAt), 'd MMM yyyy', { locale: fr })}
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${meta.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    <div className="col-span-6 md:col-span-2 text-right font-mono text-sm text-white">
                      {totalDisplay}
                    </div>
                    <div className="col-span-6 md:col-span-3 flex justify-end gap-2">
                      {canDownloadInvoice ? (
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 text-neutral-200 hover:bg-white/5 transition"
                          title="Télécharger la facture"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Facture
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-500 italic">PDF en cours…</span>
                      )}
                      {canDownloadReceipt && (
                        <a
                          href={`/api/invoices/${inv.id}/receipt/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-200/30 text-emerald-200 hover:bg-emerald-500/10 transition"
                          title="Télécharger le reçu de paiement"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Reçu
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
