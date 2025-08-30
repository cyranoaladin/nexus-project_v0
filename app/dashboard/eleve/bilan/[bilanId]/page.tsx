// app/dashboard/eleve/bilan/[bilanId]/page.tsx
import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BilanSynthese } from '@/components/bilan/BilanSynthese';
import { PdfVariantSelector } from '@/components/bilan/PdfVariantSelector';
import { SendPdfByEmail } from '@/components/bilan/SendPdfByEmail';
import { MailLogClient } from '@/components/bilan/MailLogClient';

async function getBilan(id: string) {
  const bilan = await prisma.bilan.findUnique({ where: { id }, include: { student: { include: { user: true } } } });
  return bilan;
}

async function getMailLogs(bilanId: string) {
  const logs = await prisma.mailLog.findMany({ where: { bilanId }, orderBy: { createdAt: 'desc' } });
  return logs.map(l => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    variant: l.variant,
    recipients: l.recipients,
    status: l.status,
    subject: l.subject,
    messageId: l.messageId || undefined,
  }));
}

export default async function BilanResultPage({ params }: { params: { bilanId: string } }) {
  const bilan = await getBilan(params.bilanId);
  if (!bilan) return notFound();
  const qcmScores = (bilan.qcmScores as any) || { byDomain: {}, scoreGlobal: 0 };
  const mailLogs = await getMailLogs(bilan.id);
  const byDomain = qcmScores.byDomain || {};
  const entries = Object.keys(byDomain).map((k)=>({ domain: k, percent: byDomain[k].percent ?? 0 }));
  const synthesis = (bilan.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [], text: '' };
  const offers = (bilan.offers as any) || { primary: '', alternatives: [], reasoning: '' };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <BilanSynthese
        entries={entries}
        forces={(synthesis.forces||[])}
        faiblesses={(synthesis.faiblesses||[])}
        offre={offers.primary||''}
        alternatives={(offers.alternatives||[])}
        feuilleDeRoute={(synthesis.feuilleDeRoute||[])}
      />
      <Card>
        <CardHeader>
          <CardTitle>Rapport — {bilan.student.user.firstName} {bilan.student.user.lastName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="font-semibold">Diagnostic académique</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {entries.map((d)=> (
                <div key={d.domain} className="flex items-center justify-between border rounded p-2">
                  <span>{d.domain}</span>
                  <span className="font-medium">{d.percent}%</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold">Forces</h3>
            <ul className="list-disc list-inside">
              {(synthesis.forces||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Axes de progression</h3>
            <ul className="list-disc list-inside">
              {(synthesis.faiblesses||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Feuille de route (3–6 mois)</h3>
            <ul className="list-disc list-inside">
              {(synthesis.feuilleDeRoute||[]).map((x:string,i:number)=>(<li key={i}>{x}</li>))}
            </ul>
          </section>

          {synthesis.text && (
            <section>
              <h3 className="font-semibold">Rapport complet</h3>
              <div className="prose prose-slate max-w-none whitespace-pre-wrap">{synthesis.text}</div>
            </section>
          )}

          <section>
            <h3 className="font-semibold">Recommandations Nexus</h3>
            <p><span className="font-medium">Offre principale:</span> {offers.primary||'—'}</p>
            {offers.reasoning && <p className="text-sm text-slate-600">{offers.reasoning}</p>}
            {Array.isArray(offers.alternatives) && offers.alternatives.length>0 && (
              <p className="text-sm">Alternatives: {offers.alternatives.join(', ')}</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <PdfVariantSelector bilanId={bilan.id} />
              <Link href={`/api/bilan/pdf/${bilan.id}?variant=standard`} target="_blank"><Button variant="outline">Ouvrir PDF standard</Button></Link>
            </div>
            <SendPdfByEmail bilanId={bilan.id} />
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Historique des envois</h3>
            <MailLogClient bilanId={bilan.id} rows={mailLogs as any} />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

