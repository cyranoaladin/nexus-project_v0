// app/api/bilan/email/[bilanId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pdf } from '@react-pdf/renderer';
import BilanPdf from '@/lib/pdf/BilanPdf';
import BilanPdfParent from '@/lib/pdf/BilanPdfParent';
import BilanPdfEleve from '@/lib/pdf/BilanPdfEleve';
import nodemailer from 'nodemailer';
import { toPdfData } from '@/lib/bilan/pdf-data-mapper';
import React from 'react';

import { rateLimit } from '@/lib/rate-limit';
import { getRateLimitConfig } from '@/lib/rate-limit.config';

export async function POST(req: NextRequest, { params }: { params: { bilanId: string } }) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session || !session.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { variant = 'standard', toStudent = true, toParent = true, extraRecipients = [] } = await req.json();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const conf = getRateLimitConfig('BILAN_EMAIL', { windowMs: 60_000, max: 5 });
    const rl = rateLimit(conf);
    const check = await rl(`bilan_email:${ip}`);
    if (!check.ok) return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });

    const bilan = await prisma.bilan.findUnique({
      where: { id: params.bilanId },
      include: { student: { include: { user: true, parent: { include: { user: true } } } } },
    });
    if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

    const isOwner = bilan.student.userId === session.user.id;
    const isStaff = ['ADMIN', 'ASSISTANTE', 'COACH'].includes(session.user.role);
    if (!isOwner && !isStaff) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const data = toPdfData(bilan);
    let doc: React.ReactElement;
    let label = 'Standard';
    switch ((variant || 'standard').toLowerCase()) {
      case 'parent':
        doc = React.createElement(BilanPdfParent, { data });
        label = 'Parent';
        break;
      case 'eleve':
        doc = React.createElement(BilanPdfEleve, { data });
        label = 'Élève';
        break;
      default:
        doc = React.createElement(BilanPdf, { data });
        label = 'Standard';
    }

    const buffer = await pdf(doc).toBuffer();
    const filename = `bilan-${bilan.id}-${variant}.pdf`;

    const recipients: string[] = [];
    if (toStudent && bilan.student.user.email) recipients.push(bilan.student.user.email);
    const parentEmail = (bilan.student as any)?.parent?.user?.email;
    if (toParent && parentEmail) recipients.push(parentEmail);
    if (Array.isArray(extraRecipients)) recipients.push(...extraRecipients.filter(Boolean));

    if (recipients.length === 0) return NextResponse.json({ error: 'Aucun destinataire' }, { status: 400 });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });

    const subject = `Bilan Nexus Réussite — ${bilan.student.user.firstName} ${bilan.student.user.lastName} (${label})`;

    let status: 'SENT' | 'FAILED' = 'SENT';
    let messageId: string | undefined;
    let errorMsg: string | undefined;
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'contact@nexus-reussite.tn',
        to: recipients.join(', '),
        subject,
        html: `<p>Veuillez trouver en pièce jointe le rapport ${label} du bilan.</p>`,
        attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
      });
      messageId = info.messageId;
    } catch (e: any) {
      status = 'FAILED';
      errorMsg = e?.message || 'Erreur envoi';
    }

    await prisma.mailLog.create({
      data: {
        bilanId: bilan.id,
        userId: session.user.id,
        variant: String(variant),
        recipients: recipients.join(','),
        subject,
        status,
        messageId,
        error: errorMsg,
      },
    });

    if (status === 'FAILED') return NextResponse.json({ error: errorMsg }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: recipients, messageId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}

