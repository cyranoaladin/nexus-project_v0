// ==============================================
// 🔄 Paiements — Ajouts : Listing admin + Emails auto
// ==============================================

// 1) Listing admin — API
/*
// app/api/payments/admin/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') // 'konnect' | 'wire' | 'cash' | null
  const status = searchParams.get('status')     // 'pending' | 'paid' | 'failed' | 'cancelled' | null

  const where: any = {}
  if (provider) where.provider = provider
  if (status) where.status = status

  const records = await prisma.paymentRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } }
  })

  return NextResponse.json({ ok: true, records })
}
*/

// 2) Email automatique — lib/email.ts
/*
import { sendMail } from '@/lib/mailer'

export async function sendCashReservationEmail(userEmail: string, recordId: number, amountTnd: number) {
  await sendMail({
    to: userEmail,
    subject: 'Nexus Réussite — Réservation Cash créée',
    text: `Votre réservation (ID ${recordId}) d’un montant de ${amountTnd} TND a été créée. Merci de régler au centre pour valider.`,
    html: `<p>Votre réservation <b>#${recordId}</b> d’un montant de <b>${amountTnd} TND</b> a été créée.</p><p>Merci de régler au centre pour valider.</p>`
  })
}

export async function sendCashValidationEmail(userEmail: string, recordId: number, amountTnd: number) {
  await sendMail({
    to: userEmail,
    subject: 'Nexus Réussite — Paiement validé',
    text: `Votre réservation (ID ${recordId}) a été validée. Votre compte a été crédité.`,
    html: `<p>Votre réservation <b>#${recordId}</b> a été validée.</p><p>Votre compte a été crédité avec succès.</p>`
  })
}
*/

// 3) Intégration dans endpoints cash
/*
// app/api/payments/cash/reserve/route.ts
// ... après création de record
const user = await prisma.user.findUnique({ where: { id: userId } })
if (user?.email) {
  await sendCashReservationEmail(user.email, rec.id, amountTnd)
}

// app/api/payments/cash/confirm/route.ts
// ... après update status = paid + creditUserFromPack
const user = await prisma.user.findUnique({ where: { id: rec.userId } })
if (user?.email) {
  await sendCashValidationEmail(user.email, rec.id, rec.amountTnd)
}
*/

// 4) UI Dashboard Admin
/*
- Nouvelle page/onglet "Paiements" → consomme `/api/payments/admin/list`.
- Filtres dropdown: Provider (All/Konnect/Wire/Cash), Status (All/Pending/Paid/Cancelled/Failed).
- Tableau: ID, Provider, Status, Amount, User (nom+email), Date.
- Actions contextuelles pour cash: Valider / Annuler.
*/

// 5) E2E Playwright (UI + API)
/*
// e2e/ui/admin.payments.spec.ts
import { test, expect } from '@playwright/test'

test('Admin listing paiements cash + email flow', async ({ page }) => {
  await page.goto('/admin/payments')
  await expect(page.locator('h1')).toHaveText('Paiements')
  await expect(page.locator('table')).toContainText('cash')

  // Filtrer par status = pending
  await page.selectOption('#statusFilter', 'pending')
  await expect(page.locator('table')).toContainText('pending')
})

// e2e/api/payments.cash.email.spec.ts
import { test, expect, request } from '@playwright/test'
const BASE = process.env.BASE_URL || 'http://localhost:3003'

test('Réservation cash envoie email, validation envoie email', async () => {
  const ctxParent = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { 'x-role': 'parent' } })
  const ctxAdmin = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { 'x-role': 'admin' } })

  const reserve = await ctxParent.post('/api/payments/cash/reserve', { data: { userId: 'u_parent_demo', packId: 1, amountTnd: 500 } })
  expect(reserve.ok()).toBeTruthy()

  const { recordId } = await reserve.json()
  const confirm = await ctxAdmin.post('/api/payments/cash/confirm', { data: { recordId } })
  expect(confirm.ok()).toBeTruthy()

  // Vérif logs mails (via test transport mailer)
})
*/


// ==============================================
// 📜 Listing admin PaymentRecord (filtre provider/status) + ✉️ Emails auto (cash)
// ==============================================

// 1) Endpoint d’admin — liste des paiements filtrés
/*
// app/api/admin/payments/records/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })
  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') // konnect|wire|cash|*optional
  const status = url.searchParams.get('status')     // created|pending|paid|failed|cancelled|*optional
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500)
  const where: any = {}
  if (provider) where.provider = provider
  if (status) where.status = status
  const items = await prisma.paymentRecord.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
  return NextResponse.json(items)
}
*/

// 2) Email — utilitaire nodemailer (smtp déjà présent dans .env)
/*
// lib/email.ts
import nodemailer from 'nodemailer'

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! } : undefined,
})

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Nexus Réussite <no-reply@nexus.local>'
  return mailer.sendMail({ from, to, subject, html })
}
*/

// 3) Helper — récupérer l’email du parent (fallback)
/*
// lib/users.ts
import { prisma } from '@/lib/prisma'
export async function getUserEmail(userId: string, fallback?: string) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (u?.email) return u.email
  } catch {}
  return fallback // autoriser un fallback passé par l’API si le modèle User n’existe pas
}
*/

// 4) Réservation CASH — envoyer email au parent (accusé de réception)
/*
// app/api/payments/cash/reserve/route.ts (remplacer l’implémentation précédente par cette version)
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/email'
import { getUserEmail } from '@/lib/users'

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante','parent'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })
  const { userId, packId, amountTnd, note, parentEmail } = await req.json()
  if (!userId || !packId || !amountTnd) return NextResponse.json({ error: 'userId, packId, amountTnd requis' }, { status: 400 })
  const rec = await prisma.paymentRecord.create({ data: { provider: 'cash', userId, packId, amountTnd, externalId: 'cash-reservation', status: 'pending' } })

  // Email au parent
  const to = await getUserEmail(userId, parentEmail)
  if (to) {
    await sendMail({
      to,
      subject: 'Nexus Réussite — Réservation en espèces reçue',
      html: `<p>Bonjour,</p>
             <p>Nous avons bien enregistré votre réservation d\'achat de pack de crédits au centre.</p>
             <ul>
               <li>Montant: <b>${amountTnd} TND</b></li>
               <li>Référence: <b>PR-${rec.id}</b></li>
             </ul>
             <p>Vous recevrez un e-mail de confirmation lorsque le paiement sera validé au centre.</p>
             <p>Merci pour votre confiance.<br/>L\'équipe Nexus Réussite</p>`
    })
  }

  return NextResponse.json({ ok: true, recordId: rec.id, status: rec.status, message: 'Réservation créée — validation après paiement au centre.' })
}
*/

// 5) Confirmation CASH — envoyer email de validation (wallet crédité)
/*
// app/api/payments/cash/confirm/route.ts (remplacer par cette version)
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { creditUserFromPack } from '@/app/api/payments/webhook/route' // factoriser si besoin
import { sendMail } from '@/lib/email'
import { getUserEmail } from '@/lib/users'

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })
  const { recordId, parentEmail } = await req.json()
  if (!recordId) return NextResponse.json({ error: 'recordId requis' }, { status: 400 })
  const rec = await prisma.paymentRecord.findUnique({ where: { id: Number(recordId) } })
  if (!rec || rec.provider !== 'cash') return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  if (rec.status === 'paid') return NextResponse.json({ ok: true, message: 'Déjà validé' })

  await prisma.paymentRecord.update({ where: { id: rec.id }, data: { status: 'paid' } })
  await creditUserFromPack(rec.userId, rec.packId, 'cash', `cash-confirm-${rec.id}`)

  const to = await getUserEmail(rec.userId, parentEmail)
  if (to) {
    await sendMail({
      to,
      subject: 'Nexus Réussite — Paiement validé et crédits ajoutés',
      html: `<p>Bonjour,</p>
             <p>Votre paiement au centre a été validé. Les crédits associés à votre pack ont été ajoutés à votre compte.</p>
             <ul>
               <li>Référence: <b>PR-${rec.id}</b></li>
             </ul>
             <p>Merci pour votre confiance.<br/>L\'équipe Nexus Réussite</p>`
    })
  }

  return NextResponse.json({ ok: true })
}
*/

// 6) UI Dashboard — tableau admin des PaymentRecord
/*
// Composant (extrait) : app/(admin)/components/PaymentsAdminTable.tsx
'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'

export default function PaymentsAdminTable() {
  const [provider, setProvider] = useState<string>('')
  const [status, setStatus] = useState<string>('pending')
  const { data, mutate } = useSWR(`/api/admin/payments/records?${provider?`provider=${provider}&`:''}${status?`status=${status}&`:''}limit=200`, (u)=>fetch(u).then(r=>r.json()))
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select onValueChange={setProvider}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Provider"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="">(Tous)</SelectItem>
            <SelectItem value="cash">cash</SelectItem>
            <SelectItem value="konnect">konnect</SelectItem>
            <SelectItem value="wire">wire</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="">(Tous)</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="paid">paid</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
            <SelectItem value="cancelled">cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={()=>mutate()}>Rafraîchir</Button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Provider</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Pack</th>
              <th className="p-2 text-left">Montant</th>
              <th className="p-2 text-left">Créé</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r:any)=> (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.provider}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.userId}</td>
                <td className="p-2">{r.packId}</td>
                <td className="p-2">{r.amountTnd} TND</td>
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
*/

// 7) Intégration dans le Dashboard (onglet Paiements)
/*
// Dans la section Paiements du dashboard, ajouter <PaymentsAdminTable /> sous les cartes de configuration.
*/

// 8) Remarques
// - Si votre modèle User n’existe pas encore, passez `parentEmail` dans les payloads jusqu’à ce qu’on branche PrismaAdapter.
// - Les envois SMTP utilisent vos variables `.env` déjà présentes (Mailhog/Maildev en dev recommandé).


// ==============================================
// ✉️ Emails après annulation + Template HTML brandé Nexus
// ==============================================

// 1) Template HTML — centralisé
/*
// lib/email-template.ts
export function nexusEmailTemplate({ title, body }: { title: string; body: string }) {
  return `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8"/>
    <style>
      body { font-family: Arial, sans-serif; background:#f7f9fc; color:#222; margin:0; padding:0; }
      .container { max-width:600px; margin:20px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
      .header { background:#0a2540; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold; }
      .content { padding:20px; line-height:1.6; }
      .footer { background:#f0f4f8; padding:15px; text-align:center; font-size:12px; color:#555; }
      a.button { display:inline-block; background:#ff6b00; color:#fff !important; padding:10px 18px; border-radius:6px; text-decoration:none; margin-top:10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Nexus Réussite</div>
      <div class="content">
        <h2>${title}</h2>
        ${body}
      </div>
      <div class="footer">
        Cet e-mail a été envoyé automatiquement par Nexus Réussite.<br/>
        Merci pour votre confiance.
      </div>
    </div>
  </body>
  </html>`
}
*/

// 2) Utiliser le template pour tous les emails
// Exemple dans cash/reserve et cash/confirm :
/*
await sendMail({
  to,
  subject: 'Nexus Réussite — Réservation en espèces reçue',
  html: nexusEmailTemplate({
    title: 'Réservation enregistrée',
    body: `<p>Bonjour,</p>
           <p>Nous avons bien enregistré votre réservation d'un pack de crédits au centre.</p>
           <ul><li>Montant: <b>${amountTnd} TND</b></li><li>Référence: <b>PR-${rec.id}</b></li></ul>
           <p>Vous recevrez un e-mail de confirmation lorsque le paiement sera validé.</p>`
  })
})
*/

// 3) Annulation — endpoint + email
/*
// app/api/payments/cash/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/email'
import { getUserEmail } from '@/lib/users'
import { nexusEmailTemplate } from '@/lib/email-template'

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })
  const { recordId, parentEmail } = await req.json()
  if (!recordId) return NextResponse.json({ error: 'recordId requis' }, { status: 400 })
  const rec = await prisma.paymentRecord.findUnique({ where: { id: Number(recordId) } })
  if (!rec || rec.provider !== 'cash') return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  if (rec.status === 'cancelled') return NextResponse.json({ ok: true, message: 'Déjà annulé' })

  await prisma.paymentRecord.update({ where: { id: rec.id }, data: { status: 'cancelled' } })

  const to = await getUserEmail(rec.userId, parentEmail)
  if (to) {
    await sendMail({
      to,
      subject: 'Nexus Réussite — Réservation annulée',
      html: nexusEmailTemplate({
        title: 'Votre réservation a été annulée',
        body: `<p>Bonjour,</p>
               <p>Votre réservation (réf: PR-${rec.id}) a été annulée par notre équipe.</p>
               <p>Pour toute question, merci de nous contacter.</p>`
      })
    })
  }

  return NextResponse.json({ ok: true })
}
*/

// 4) UI Dashboard — bouton "Annuler" dans PaymentsAdminTable
/*
// Exemple d’intégration rapide
<Button variant="destructive" onClick={async()=>{
  await fetch('/api/payments/cash/cancel', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ recordId:r.id }) })
  mutate()
}}>Annuler</Button>
*/


// ==============================================
// ✉️ Templates email (branding Nexus) + envoi après annulation CASH
// ==============================================

// 1) Templates HTML — lib/email/templates.ts
/*
// lib/email/templates.ts
const BRAND = {
  name: 'Nexus Réussite',
  logo: process.env.NEXUS_LOGO_URL || 'https://nexusreussite.academy/images/logo_nexus.png', // à remplacer par votre URL prod
  color: '#0f172a', // bleu nuit
  accent: '#06b6d4', // cyan
}

function layout({ title, body, preview }: { title: string; body: string; preview?: string }) {
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${title}</title>
    <style>
      body{background:#f6f7fb;margin:0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a}
      .container{max-width:640px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(2,8,23,.08)}
      .header{display:flex;align-items:center;gap:12px;padding:20px 24px;background:${BRAND.color};color:#fff}
      .header img{height:28px}
      .content{padding:24px}
      h1{font-size:20px;margin:0 0 12px}
      p{line-height:1.6;color:#334155}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:${BRAND.accent};color:#06202a;font-size:12px;font-weight:600}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin:12px 0}
      .footer{padding:16px 24px;color:#64748b;font-size:12px}
      .btn{display:inline-block;background:${BRAND.accent};color:#06202a;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700}
      .muted{color:#64748b}
    </style>
  </head>
  <body>
    <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${preview || ''}</span>
    <div class="container">
      <div class="header"><img src="${BRAND.logo}" alt="${BRAND.name}"/><strong>${BRAND.name}</strong></div>
      <div class="content">${body}</div>
      <div class="footer">Cet email vous est adressé par ${BRAND.name}. Merci pour votre confiance.</div>
    </div>
  </body>
  </html>`
}

export function tplCashReserved({ amountTnd, recordId }:{ amountTnd:number; recordId:number }) {
  const title = 'Réservation enregistrée — Paiement au centre'
  const body = `
    <span class="badge">Réservation cash</span>
    <h1>Nous avons bien reçu votre demande</h1>
    <p>Montant : <b>${amountTnd} TND</b></p>
    <div class="card">Référence réservation : <b>PR-${recordId}</b></div>
    <p class="muted">Présentez-vous au centre pour finaliser le paiement. Vous recevrez un email de confirmation après validation.</p>
  `
  return layout({ title, body, preview: `Réservation cash PR-${recordId}` })
}

export function tplCashConfirmed({ recordId }:{ recordId:number }) {
  const title = 'Paiement validé — Crédits ajoutés'
  const body = `
    <span class="badge">Confirmation</span>
    <h1>Votre paiement a été validé</h1>
    <p>Les crédits associés à votre pack ont été ajoutés à votre compte.</p>
    <div class="card">Référence : <b>PR-${recordId}</b></div>
  `
  return layout({ title, body, preview: `Paiement validé PR-${recordId}` })
}

export function tplCashCancelled({ recordId }:{ recordId:number }) {
  const title = 'Réservation annulée'
  const body = `
    <span class="badge">Annulation</span>
    <h1>Votre réservation a été annulée</h1>
    <p>La réservation au centre portant la référence ci-dessous a été annulée. Pour toute question ou pour reprogrammer un passage, contactez-nous.</p>
    <div class="card">Référence : <b>PR-${recordId}</b></div>
  `
  return layout({ title, body, preview: `Annulation PR-${recordId}` })
}
*/

// 2) Brancher les templates dans les routes cash (reserve/confirm/cancel)
/*
// a) reserve — utiliser tplCashReserved
// app/api/payments/cash/reserve/route.ts
import { tplCashReserved } from '@/lib/email/templates'
// ... après création PaymentRecord
if (to) { await sendMail({ to, subject: 'Nexus — Réservation en espèces reçue', html: tplCashReserved({ amountTnd, recordId: rec.id }) }) }

// b) confirm — utiliser tplCashConfirmed
// app/api/payments/cash/confirm/route.ts
import { tplCashConfirmed } from '@/lib/email/templates'
// ... après creditUserFromPack
if (to) { await sendMail({ to, subject: 'Nexus — Paiement validé et crédits ajoutés', html: tplCashConfirmed({ recordId: rec.id }) }) }
*/

// 3) Annulation CASH — envoyer email avec template
/*
// app/api/payments/cash/cancel/route.ts (remplacer par cette version)
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/email'
import { getUserEmail } from '@/lib/users'
import { tplCashCancelled } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ['admin','assistante'])
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status })
  const { recordId, parentEmail } = await req.json()
  if (!recordId) return NextResponse.json({ error: 'recordId requis' }, { status: 400 })

  const rec = await prisma.paymentRecord.findUnique({ where: { id: Number(recordId) } })
  if (!rec || rec.provider !== 'cash') return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  await prisma.paymentRecord.update({ where: { id: rec.id }, data: { status: 'cancelled' } })

  const to = await getUserEmail(rec.userId, parentEmail)
  if (to) {
    await sendMail({ to, subject: 'Nexus — Réservation annulée', html: tplCashCancelled({ recordId: rec.id }) })
  }

  return NextResponse.json({ ok: true })
}
*/

// 4) UI — petits plus
/*
// - Dans le Dashboard (PaymentsAdminTable), afficher un bouton "Annuler" pour les lignes `status=pending` + provider=cash.
// - Toasts : "Email envoyé au parent" après confirm/cancel si 200.
// - Option : afficher un aperçu HTML du template (iframe) dans un drawer admin pour QA.
*/
