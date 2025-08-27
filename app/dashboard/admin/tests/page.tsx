'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Activity, Database, Mail, CreditCard, Globe } from 'lucide-react';

interface ServicePing { ok: boolean; ms: number; error?: string }
interface StatusData {
  status: 'ok' | 'degraded' | 'down' | 'error';
  app?: { db: { connected: boolean; userCount: number; ms: number } };
  services?: { rag: ServicePing; llm: ServicePing; pdf: ServicePing };
  timestamp: string;
}

interface EmailConfigVar { variable: string; configured: boolean; value: string }
interface EmailConfigData { success: boolean; configuration: EmailConfigVar[]; allConfigured: boolean }

interface PaymentsConfigData {
  success: boolean;
  configuration: {
    konnect: { apiKey: boolean; walletId: boolean; publicKey: boolean; webhookSecret: boolean };
    wise: { apiKey: boolean; profileId: boolean };
    allConfigured: boolean;
  };
}

export default function AdminTestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigData | null>(null);
  const [paymentsConfig, setPaymentsConfig] = useState<PaymentsConfigData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Email test state
  const [testEmail, setTestEmail] = useState('');
  const [emailActionMsg, setEmailActionMsg] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  // Payments test state
  const [konnectMsg, setKonnectMsg] = useState<string | null>(null);
  const [konnectBusy, setKonnectBusy] = useState(false);
  const [amountMillimes, setAmountMillimes] = useState('450000');
  const [paymentRef, setPaymentRef] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [s, e, p] = await Promise.all([
          fetch('/api/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          fetch('/api/admin/test-email', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          fetch('/api/admin/test-payments', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
        ]);
        setStatusData(s);
        setEmailConfig(e);
        setPaymentsConfig(p);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, router]);

  const refreshEmailConfig = async () => {
    const e = await fetch('/api/admin/test-email', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setEmailConfig(e);
  };
  const refreshPaymentsConfig = async () => {
    const p = await fetch('/api/admin/test-payments', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setPaymentsConfig(p);
  };

  // Actions Email
  const testEmailConfigAction = async () => {
    try {
      setEmailBusy(true);
      setEmailActionMsg(null);
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_config' }),
      });
      const data = await res.json();
      setEmailActionMsg(data?.success ? 'Configuration SMTP OK' : (data?.error || 'Échec test SMTP'));
      await refreshEmailConfig();
    } catch {
      setEmailActionMsg('Erreur lors du test de configuration SMTP');
    } finally {
      setEmailBusy(false);
    }
  };

  const sendTestEmailAction = async () => {
    if (!testEmail) {
      setEmailActionMsg('Veuillez saisir une adresse email');
      return;
    }
    try {
      setEmailBusy(true);
      setEmailActionMsg(null);
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test', testEmail }),
      });
      const data = await res.json();
      setEmailActionMsg(data?.success ? `Email de test envoyé à ${testEmail}` : (data?.error || 'Échec envoi email'));
    } catch {
      setEmailActionMsg('Erreur lors de l\'envoi de l\'email de test');
    } finally {
      setEmailBusy(false);
    }
  };

  // Actions Paiement
  const testKonnectConnection = async () => {
    try {
      setKonnectBusy(true);
      setKonnectMsg(null);
      const res = await fetch('/api/admin/test-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' }),
      });
      const data = await res.json();
      if (data?.success) {
        setKonnectMsg(`Connexion OK. paymentRef: ${data.paymentRef || 'n/a'}`);
      } else {
        setKonnectMsg(`Échec: ${data?.error || 'Erreur inconnue'}`);
      }
      await refreshPaymentsConfig();
    } catch {
      setKonnectMsg('Erreur lors du test de connexion Konnect');
    } finally {
      setKonnectBusy(false);
    }
  };

  const createTestPayment = async () => {
    const amt = parseInt(amountMillimes, 10);
    if (isNaN(amt) || amt < 100) {
      setKonnectMsg('Montant invalide (min 100 millimes)');
      return;
    }
    try {
      setKonnectBusy(true);
      setKonnectMsg(null);
      const res = await fetch('/api/admin/test-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_test_payment', amount: amt }),
      });
      const data = await res.json();
      if (data?.success) {
        setKonnectMsg(`Paiement de test créé. Ref: ${data?.payment?.reference || 'n/a'}`);
      } else {
        setKonnectMsg(`Échec: ${data?.error || 'Erreur inconnue'}`);
      }
    } catch {
      setKonnectMsg('Erreur lors de la création du paiement de test');
    } finally {
      setKonnectBusy(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentRef) {
      setKonnectMsg('Veuillez saisir une référence de paiement');
      return;
    }
    try {
      setKonnectBusy(true);
      setKonnectMsg(null);
      const res = await fetch('/api/admin/test-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', paymentRef }),
      });
      const data = await res.json();
      if (data?.success) {
        setKonnectMsg(`Statut: ${data?.payment?.status || 'n/a'}`);
      } else {
        setKonnectMsg(`Échec: ${data?.error || 'Erreur inconnue'}`);
      }
    } catch {
      setKonnectMsg('Erreur lors de la vérification du statut');
    } finally {
      setKonnectBusy(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement du panneau de diagnostic…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tests Système</h1>
          <p className="text-gray-600 text-sm">Diagnostic rapide des composants critiques</p>
        </div>

        {/* Statut Système (DB + services) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" /> Statut Système
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Base de données: {statusData?.app?.db?.connected ? (
                <span className="text-green-700 font-medium">OK</span>
              ) : (
                <span className="text-red-600 font-medium">KO</span>
              )}
              {statusData?.app?.db && (
                <span className="text-gray-500">(utilisateurs: {statusData.app.db.userCount}, {statusData.app.db.ms} ms)</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">RAG Service</div>
                <div className={statusData?.services?.rag.ok ? 'text-green-700' : 'text-red-600'}>{statusData?.services?.rag.ok ? 'OK' : 'KO'} ({statusData?.services?.rag.ms ?? '-'} ms)</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">LLM Service</div>
                <div className={statusData?.services?.llm.ok ? 'text-green-700' : 'text-red-600'}>{statusData?.services?.llm.ok ? 'OK' : 'KO'} ({statusData?.services?.llm.ms ?? '-'} ms)</div>
              </div>
              <div className="p-3 rounded border">
                <div className="text-xs text-gray-500">PDF Service</div>
                <div className={statusData?.services?.pdf.ok ? 'text-green-700' : 'text-red-600'}>{statusData?.services?.pdf.ok ? 'OK' : 'KO'} ({statusData?.services?.pdf.ms ?? '-'} ms)</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">Dernière mise à jour: {statusData?.timestamp ? new Date(statusData.timestamp).toLocaleString('fr-FR') : '-'}</div>
          </CardContent>
        </Card>

        {/* Email SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" /> Email (SMTP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <div className="mb-2 font-medium">Configuration</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {emailConfig?.configuration?.map((c) => (
                  <div key={c.variable} className="p-2 rounded border text-xs flex items-center justify-between">
                    <span className="text-gray-700">{c.variable}</span>
                    <span className={c.configured ? 'text-green-700' : 'text-red-600'}>{c.configured ? 'OK' : 'KO'}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tout configuré: {emailConfig?.allConfigured ? 'Oui' : 'Non'}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-1">
                <Label htmlFor="testEmail">Envoyer un email de test</Label>
                <Input id="testEmail" placeholder="destinataire@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Button disabled={emailBusy} onClick={sendTestEmailAction}>Envoyer</Button>
                <Button disabled={emailBusy} variant="outline" onClick={testEmailConfigAction}>Tester la configuration</Button>
              </div>
              {emailActionMsg && <div className="text-sm text-gray-700">{emailActionMsg}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Paiements (Konnect/ Wise) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" /> Paiements (Konnect / Wise)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <div className="mb-2 font-medium">Configuration</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 rounded border text-xs">
                  <div className="font-medium text-gray-700 mb-1">Konnect</div>
                  <div>API key: <span className={paymentsConfig?.configuration?.konnect.apiKey ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.konnect.apiKey ? 'OK' : 'KO'}</span></div>
                  <div>Wallet: <span className={paymentsConfig?.configuration?.konnect.walletId ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.konnect.walletId ? 'OK' : 'KO'}</span></div>
                  <div>Public key: <span className={paymentsConfig?.configuration?.konnect.publicKey ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.konnect.publicKey ? 'OK' : 'KO'}</span></div>
                  <div>Webhook secret: <span className={paymentsConfig?.configuration?.konnect.webhookSecret ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.konnect.webhookSecret ? 'OK' : 'KO'}</span></div>
                </div>
                <div className="p-2 rounded border text-xs">
                  <div className="font-medium text-gray-700 mb-1">Wise</div>
                  <div>API key: <span className={paymentsConfig?.configuration?.wise.apiKey ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.wise.apiKey ? 'OK' : 'KO'}</span></div>
                  <div>Profile ID: <span className={paymentsConfig?.configuration?.wise.profileId ? 'text-green-700' : 'text-red-600'}>{paymentsConfig?.configuration?.wise.profileId ? 'OK' : 'KO'}</span></div>
                </div>
                <div className="p-2 rounded border text-xs flex items-center justify-between">
                  <span className="text-gray-700">Tout configuré</span>
                  <span className={paymentsConfig?.configuration?.allConfigured ? 'text-green-700' : 'text-orange-600'}>{paymentsConfig?.configuration?.allConfigured ? 'Oui' : 'Partiel'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Button disabled={konnectBusy} onClick={testKonnectConnection}>Tester connexion Konnect</Button>
              <div>
                <Label htmlFor="amount">Montant (millimes)</Label>
                <Input id="amount" value={amountMillimes} onChange={(e) => setAmountMillimes(e.target.value)} className="w-48" />
              </div>
              <Button disabled={konnectBusy} variant="outline" onClick={createTestPayment}>Créer paiement de test</Button>
              <div>
                <Label htmlFor="paymentRef">Référence paiement</Label>
                <Input id="paymentRef" placeholder="PAY_xxx" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="w-64" />
              </div>
              <Button disabled={konnectBusy} variant="outline" onClick={checkPaymentStatus}>Vérifier statut</Button>
              {konnectMsg && <div className="text-sm text-gray-700">{konnectMsg}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Liens rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" /> Liens Rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-1">
            <div>• Healthcheck API: <code>/api/status</code></div>
            <div>• Test Email: <code>/api/admin/test-email</code></div>
            <div>• Test Paiements: <code>/api/admin/test-payments</code></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
