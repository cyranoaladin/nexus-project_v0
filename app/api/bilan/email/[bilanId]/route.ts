import { getJob } from '@/lib/bilan/jobs';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: { bilanId: string; }; }) {
  try {
    const id = ctx.params.bilanId;
    // E2E fast-path: pas d'envoi réel, succès immédiat
    if (process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
      return NextResponse.json({ ok: true, sent: true, bilanId: id });
    }

    const url = new URL(req.url);
    const to = url.searchParams.get('to') || process.env.SMTP_TEST_TO;
    if (!to) return NextResponse.json({ error: 'missing_to' }, { status: 400 });
    const job = getJob(id);
    if (!job || job.status !== 'done' || !job.outputPath || !fs.existsSync(job.outputPath)) {
      return NextResponse.json({ error: 'not_ready' }, { status: 409 });
    }

    const host = process.env.SMTP_HOST || 'localhost';
    const port = Number(process.env.SMTP_PORT || 1025);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.SMTP_FROM || 'noreply@nexus.local';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user ? { user, pass } : undefined,
    } as any);

    const pdfBuf = fs.readFileSync(job.outputPath);
    await transporter.sendMail({
      from,
      to,
      subject: `Votre Bilan Premium (${job.variant})`,
      text: 'Veuillez trouver ci-joint votre bilan au format PDF.',
      attachments: [{ filename: `bilan_${id}.pdf`, content: pdfBuf }],
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'email_failed', message: String(e?.message || e) }, { status: 500 });
  }
}
