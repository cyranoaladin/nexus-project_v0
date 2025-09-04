'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Tooltip components not available; fallback to simple title attributes
import { Building2, CreditCard, FileText, HandCoins, Loader2, Plus, RefreshCw, Save, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

// ----------------------
// Utils
// ----------------------
const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(async r => {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
});

const postJSON = async (url: string, body: any) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const putJSON = async (url: string, body: any) => {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const del = async (url: string) => {
  const r = await fetch(url, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

function useEventSource(url?: string) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url, { withCredentials: true });
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    return () => es.close();
  }, [url]);
  return online;
}

// ----------------------
// Types
// ----------------------
interface PricingItem {
  id: number;
  service: string;
  variable: string;
  valeur: number;
  devise: string;
  updatedAt: string;
}

interface CreditPack {
  id: number;
  credits: number;
  priceTnd: number;
  bonus?: number;
  active: boolean;
  updatedAt: string;
}

interface CreditUsage {
  key: string; // ex: SOS_15, SOS_30, SOS_60, COURS_INDIV_HEURE
  credits: number;
}

interface PaymentSettings {
  allowCard: boolean;
  allowWire: boolean;
  allowCash: boolean;
  iban?: string;
  cashNote?: string;
}

interface BillingPolicy {
  annualDepositPct: number; // ex 20
  scheduleEndISO: string; // ex '2026-06-30'
}

interface OfferBinding {
  code: string; // ex: ODYSSEE_TERMINALE
  label: string;
  pricingRefs: { variable: string; label: string; }[];
  includeAria: boolean;
}

// ----------------------
// Main Component
// ----------------------
export default function AdminPricingDashboard() {
  const { data: pricing, mutate: mutatePricing, isLoading: loadingPricing } = useSWR<PricingItem[]>('/api/pricing', fetcher);
  const { data: packs, mutate: mutatePacks } = useSWR<CreditPack[]>('/api/credits/packs', fetcher);
  const { data: usage, mutate: mutateUsage } = useSWR<CreditUsage[]>('/api/credits/usage', fetcher);
  const { data: payments, mutate: mutatePayments } = useSWR<PaymentSettings>('/api/payments/settings', fetcher);
  const { data: policy, mutate: mutatePolicy } = useSWR<BillingPolicy>('/api/billing/policy', fetcher);
  const { data: audit } = useSWR<any[]>('/api/admin/audit?limit=50', fetcher);

  const online = useEventSource('/api/pricing/stream');

  // Live revalidate hook (optional)
  const revalidateSite = async (paths: string[]) => {
    try {
      await postJSON('/api/revalidate', { paths });
      toast.success('Revalidation envoyée');
    } catch (e: any) {
      toast.error(e.message || 'Échec revalidation');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Tarifs & Offres</h1>
          <p className="text-sm text-muted-foreground">Admin & Assistante — mise à jour en temps réel</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={online ? 'success' : 'outline'} className="flex items-center gap-1">
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? 'Temps réel actif' : 'Temps réel inactif'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => revalidateSite(['/offres', '/offres/nexus-cortex', '/offres/studio-flex', '/offres/academies-nexus', '/offres/programme-odyssee'])}>
            <RefreshCw className="mr-2 h-4 w-4" /> Revalider le site
          </Button>
        </div>
      </header>

      <Tabs value="pricing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pricing">Tarifs dynamiques</TabsTrigger>
          <TabsTrigger value="credits">Crédits & usages</TabsTrigger>
          <TabsTrigger value="offers">Offres & ARIA</TabsTrigger>
          <TabsTrigger value="billing">Échelonnement</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing"><PricingManager data={pricing} loading={loadingPricing} onChange={mutatePricing as any} /></TabsContent>
        <TabsContent value="credits"><CreditsManager packs={packs} usage={usage} onPacks={mutatePacks as any} onUsage={mutateUsage as any} /></TabsContent>
        <TabsContent value="offers"><OffersBinder pricing={pricing} /></TabsContent>
        <TabsContent value="billing"><BillingPolicyCard policy={policy} onSave={mutatePolicy as any} /></TabsContent>
        <TabsContent value="payments"><PaymentsCard settings={payments} onSave={mutatePayments as any} /></TabsContent>
        <TabsContent value="audit"><AuditLog items={audit} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------
// Pricing Manager
// ----------------------
function PricingManager({ data, loading, onChange }: { data?: PricingItem[]; loading?: boolean; onChange: (d?: any, revalidate?: boolean) => void; }) {
  const [filter, setFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(x => (filter ? x.service === filter : true) && (q ? (x.variable.toLowerCase().includes(q.toLowerCase()) || x.service.toLowerCase().includes(q.toLowerCase())) : true));
  }, [data, filter, q]);

  const services = useMemo(() => Array.from(new Set((data || []).map(d => d.service))), [data]);

  const updateItem = async (row: PricingItem, patch: Partial<PricingItem>) => {
    const next = { ...row, ...patch };
    onChange((prev: PricingItem[] | undefined) => prev?.map((x: PricingItem) => x.id === row.id ? next : x), false);
    try {
      setSaving(true);
      await putJSON(`/api/pricing/${row.id}`, patch);
      toast.success('Tarif mis à jour');
      onChange();
    } catch (e: any) {
      toast.error(e.message || 'Échec mise à jour');
      onChange(); // refetch server
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    const body = { service: 'Studio Flex', variable: 'nouveau_tarif', valeur: 0, devise: 'TND' };
    try {
      setSaving(true);
      await postJSON('/api/pricing', body);
      toast.success('Tarif ajouté');
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const removeItem = async (row: PricingItem) => {
    try { await del(`/api/pricing/${row.id}`); toast.success('Tarif supprimé'); onChange(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>Tarifs dynamiques</CardTitle>
        <CardDescription>Modification en temps réel, affichée sur le site public.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select onValueChange={setFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrer par service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {services.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input placeholder="Recherche (service ou variable)" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4" />Ajouter un tarif</Button>
          {saving && <span className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</span>}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {(loading ? Array.from({ length: 4 }) : filtered).map((row: any, i: number) => (
            <div key={row?.id ?? i} className="grid grid-cols-12 gap-2 items-center bg-muted/20 p-3 rounded-2xl">
              <div className="col-span-2">
                <Label>Service</Label>
                <Input defaultValue={row?.service} onBlur={e => row && updateItem(row, { service: e.target.value })} placeholder="ARIA / Studio Flex / Odyssée / Académies / SOS" />
              </div>
              <div className="col-span-3">
                <Label>Variable</Label>
                <Input defaultValue={row?.variable} onBlur={e => row && updateItem(row, { variable: e.target.value })} placeholder="ex: prix_individuel" />
              </div>
              <div className="col-span-3">
                <Label>Valeur</Label>
                <Input type="number" step="0.01" defaultValue={row?.valeur} onBlur={e => row && updateItem(row, { valeur: Number(e.target.value) })} />
              </div>
              <div className="col-span-1">
                <Label>Devise</Label>
                <Input defaultValue={row?.devise ?? 'TND'} onBlur={e => row && updateItem(row, { devise: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-end justify-end gap-2">
                <Button title="Supprimer" variant="ghost" size="icon" onClick={() => removeItem(row)}><Trash2 className="h-4 w-4" /></Button>
                <Badge variant="outline">MAJ {row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------
// Credits Manager (placeholders; endpoints à implémenter)
// ----------------------
function CreditsManager({ packs, usage, onPacks, onUsage }: { packs?: CreditPack[]; usage?: CreditUsage[]; onPacks: (d?: any) => void; onUsage: (d?: any) => void; }) {
  const addPack = async () => {
    const body = { credits: 50, priceTnd: 500, bonus: 0, active: true };
    try { await postJSON('/api/credits/packs', body); toast.success('Pack ajouté'); onPacks(); } catch (e: any) { toast.error(e.message); }
  };
  const savePack = async (p: CreditPack, patch: Partial<CreditPack>) => {
    try { await putJSON(`/api/credits/packs/${p.id}`, patch); toast.success('Pack mis à jour'); onPacks(); } catch (e: any) { toast.error(e.message); }
  };
  const togglePack = async (p: CreditPack) => savePack(p, { active: !p.active });
  const rmPack = async (p: CreditPack) => { try { await del(`/api/credits/packs/${p.id}`); toast.success('Supprimé'); onPacks(); } catch (e: any) { toast.error(e.message); } };

  const addUsage = async () => { try { await postJSON('/api/credits/usage', { key: 'SOS_15', credits: 5 }); toast.success('Usage ajouté'); onUsage(); } catch (e: any) { toast.error(e.message); } };
  const saveUsage = async (u: CreditUsage, patch: Partial<CreditUsage>) => { try { await putJSON(`/api/credits/usage/${u.key}`, patch); toast.success('Usage mis à jour'); onUsage(); } catch (e: any) { toast.error(e.message); } };
  const rmUsage = async (u: CreditUsage) => { try { await del(`/api/credits/usage/${u.key}`); toast.success('Supprimé'); onUsage(); } catch (e: any) { toast.error(e.message); } };

  return (
    <div className="grid xl:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Packs de crédits</CardTitle>
          <CardDescription>1 crédit = 10 TND. Rechargez les comptes parents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={addPack}><Plus className="h-4 w-4 mr-2" />Ajouter un pack</Button></div>
          <div className="space-y-3">
            {(packs || []).map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-2 bg-muted/20 p-3 rounded-2xl items-center">
                <div className="col-span-2"><Label>Crédits</Label><Input type="number" defaultValue={p.credits} onBlur={e => savePack(p, { credits: Number(e.target.value) })} /></div>
                <div className="col-span-3"><Label>Prix (TND)</Label><Input type="number" step="0.01" defaultValue={p.priceTnd} onBlur={e => savePack(p, { priceTnd: Number(e.target.value) })} /></div>
                <div className="col-span-2"><Label>Bonus</Label><Input type="number" defaultValue={p.bonus || 0} onBlur={e => savePack(p, { bonus: Number(e.target.value) || 0 })} /></div>
                <div className="col-span-2 flex items-end gap-2">
                  <Switch checked={p.active} onCheckedChange={() => togglePack(p)} /> <span className="text-sm">Actif</span>
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  <Button title="Supprimer" variant="ghost" size="icon" onClick={() => rmPack(p)}><Trash2 className="h-4 w-4" /></Button>
                  <Badge variant="outline">MAJ {new Date(p.updatedAt).toLocaleString()}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usages des crédits</CardTitle>
          <CardDescription>Barème par action (ex: SOS 15 min = 5 crédits).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={addUsage}><Plus className="h-4 w-4 mr-2" />Ajouter un usage</Button></div>
          <div className="space-y-3">
            {(usage || []).map(u => (
              <div key={u.key} className="grid grid-cols-12 gap-2 bg-muted/20 p-3 rounded-2xl items-center">
                <div className="col-span-5"><Label>Code</Label><Input defaultValue={u.key} onBlur={e => saveUsage(u, { key: e.target.value })} /></div>
                <div className="col-span-4"><Label>Crédits</Label><Input type="number" defaultValue={u.credits} onBlur={e => saveUsage(u, { credits: Number(e.target.value) })} /></div>
                <div className="col-span-3 flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => rmUsage(u)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------
// Offers Binder
// ----------------------
const DEFAULT_OFFERS: OfferBinding[] = [
  { code: 'ARIA_MATIERE', label: 'ARIA par matière (mensuel)', pricingRefs: [{ variable: 'ARIA_tarif_matiere', label: 'Prix par matière/mois' }], includeAria: true },
  { code: 'STUDIO_FLEX_INDIV', label: 'Cours individuel (heure)', pricingRefs: [{ variable: 'prix_individuel', label: 'Prix heure indiv' }], includeAria: false },
  { code: 'GROUPE_4H', label: 'Cours groupe 4 (heure)', pricingRefs: [{ variable: 'prix_groupe4', label: 'Prix heure groupe 4' }], includeAria: false },
  { code: 'STAGE_G8', label: 'Stage vacances groupe 8 (heure)', pricingRefs: [{ variable: 'prix_stage_groupe8', label: 'Prix heure stage G8' }], includeAria: false },
  { code: 'ODYSSEE_PREMIERE', label: 'Pack annuel Première', pricingRefs: [{ variable: 'Odysee_Premiere', label: 'Prix annuel' }], includeAria: true },
  { code: 'ODYSSEE_TERMINALE', label: 'Pack annuel Terminale', pricingRefs: [{ variable: 'Odysee_Terminale', label: 'Prix annuel' }], includeAria: true },
  { code: 'PACK_LIBRES', label: 'Pack Candidats libres', pricingRefs: [{ variable: 'prix_pack_libres', label: 'Prix pack' }], includeAria: true },
];

function OffersBinder({ pricing }: { pricing?: PricingItem[]; }) {
  const [offers, setOffers] = useState<OfferBinding[]>(DEFAULT_OFFERS);

  const allVars = useMemo(() => new Set((pricing || []).map(x => x.variable)), [pricing]);

  const saveOffers = async () => {
    try { await putJSON('/api/offers/bindings', { offers }); toast.success('Offres liées aux variables'); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offres & ARIA — Liaisons</CardTitle>
        <CardDescription>Reliez chaque offre visible au public à une ou plusieurs variables de tarification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.map((o, idx) => (
          <div key={o.code} className="bg-muted/20 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{o.code}</Badge>
              <Input className="max-w-xl" defaultValue={o.label} onBlur={e => {
                const next = [...offers]; next[idx] = { ...o, label: e.target.value }; setOffers(next);
              }} />
              <div className="ml-auto flex items-center gap-2">
                <Switch checked={o.includeAria} onCheckedChange={(v) => { const next = [...offers]; next[idx] = { ...o, includeAria: v }; setOffers(next); }} />
                <span className="text-sm">Inclure ARIA</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {o.pricingRefs.map((ref, rIdx) => (
                <div key={rIdx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><Label>Libellé</Label><Input defaultValue={ref.label} onBlur={e => { const next = [...offers]; const refs = [...o.pricingRefs]; refs[rIdx] = { ...ref, label: e.target.value }; next[idx] = { ...o, pricingRefs: refs }; setOffers(next); }} /></div>
                  <div className="col-span-7">
                    <Label>Variable de tarification</Label>
                    <Input list={`vars-${idx}-${rIdx}`} defaultValue={ref.variable} onBlur={e => { const next = [...offers]; const refs = [...o.pricingRefs]; refs[rIdx] = { ...ref, variable: e.target.value }; next[idx] = { ...o, pricingRefs: refs }; setOffers(next); }} placeholder="ex: prix_individuel" />
                    <datalist id={`vars-${idx}-${rIdx}`}>
                      {[...allVars].map(v => <option key={v} value={v as string}>{v as string}</option>)}
                    </datalist>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={saveOffers}><Save className="h-4 w-4 mr-2" />Sauvegarder les liaisons</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------
// Billing Policy (placeholder)
// ----------------------
function BillingPolicyCard({ policy, onSave }: { policy?: BillingPolicy; onSave: (d?: any) => void; }) {
  const [deposit, setDeposit] = useState<number>(policy?.annualDepositPct ?? 20);
  const [endISO, setEndISO] = useState<string>(policy?.scheduleEndISO ?? '2026-06-30');

  useEffect(() => { if (policy) { setDeposit(policy.annualDepositPct); setEndISO(policy.scheduleEndISO); } }, [policy]);

  const save = async () => {
    try { await putJSON('/api/billing/policy', { annualDepositPct: deposit, scheduleEndISO: endISO }); toast.success('Politique de facturation mise à jour'); onSave(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Échelonnement (Offres annuelles)</CardTitle>
        <CardDescription>Règle globale : 20% à la souscription, solde jusqu’à juin 2026 (paramétrable ici).</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Acompte à la souscription (%)</Label>
          <Input type="number" step="1" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
        </div>
        <div>
          <Label>Fin de l’échéancier (ISO)</Label>
          <Input type="date" value={endISO} onChange={(e) => setEndISO(e.target.value)} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={save}><Save className="h-4 w-4 mr-2" />Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------
// Payments (placeholder)
// ----------------------
function PaymentsCard({ settings, onSave }: { settings?: PaymentSettings; onSave: (d?: any) => void; }) {
  const [s, setS] = useState<PaymentSettings>({ allowCard: true, allowWire: true, allowCash: true, iban: '', cashNote: '' });
  useEffect(() => { if (settings) setS(settings); }, [settings]);

  const save = async () => {
    try { await putJSON('/api/payments/settings', s); toast.success('Paramètres de paiement enregistrés'); onSave(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moyens de paiement</CardTitle>
        <CardDescription>CB (Konnect TND), virement bancaire (TND) et espèces au centre.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2"><Switch checked={s.allowCard} onCheckedChange={(v) => setS(prev => ({ ...prev, allowCard: v }))} /><CreditCard className="h-4 w-4" /> <span>Carte bancaire (Konnect TND)</span></div>
          <div className="flex items-center gap-2"><Switch checked={s.allowWire} onCheckedChange={(v) => setS(prev => ({ ...prev, allowWire: v }))} /><Building2 className="h-4 w-4" /> <span>Virement bancaire (TND)</span></div>
          <div className="flex items-center gap-2"><Switch checked={s.allowCash} onCheckedChange={(v) => setS(prev => ({ ...prev, allowCash: v }))} /><HandCoins className="h-4 w-4" /> <span>Espèces au centre</span></div>
        </div>
        <Separator />
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>IBAN</Label>
            <Input placeholder="TNxx xxxx xxxx xxxx xxxx xxxx" value={s.iban || ''} onChange={e => setS(prev => ({ ...prev, iban: e.target.value }))} />
          </div>
          <div>
            <Label>Note pour paiement en espèces</Label>
            <Input placeholder="Ex: reçu remis immédiatement…" value={s.cashNote || ''} onChange={e => setS(prev => ({ ...prev, cashNote: e.target.value }))} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Paiement carte</Label>
            <Button variant="outline" disabled title="Bientôt disponible (Konnect)">Bientôt disponible</Button>
          </div>
          <div>
            <Label>Virement bancaire</Label>
            <Button variant="outline" disabled title="Bientôt disponible (RIB)">Bientôt disponible</Button>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={save}><Save className="h-4 w-4 mr-2" />Sauvegarder</Button></div>
      </CardContent>
    </Card>
  );
}

// ----------------------
// Audit log (placeholder)
// ----------------------
function AuditLog({ items }: { items?: any[]; }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal des actions</CardTitle>
        <CardDescription>Dernières modifications (tarifs, packs, politiques).</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[360px] pr-4">
          <div className="space-y-2">
            {(items || []).map((it, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/20 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{it.action}</div>
                    <div className="text-xs text-muted-foreground">{it.actor} • {new Date(it.at).toLocaleString()}</div>
                  </div>
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{JSON.stringify(it.diff || {})}</code>
              </div>
            ))}
            {!items?.length && <div className="text-sm text-muted-foreground">Aucune activité récente.</div>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
