// app/api/debug/pdf/remote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pdf_generator_service } from '@/lib/aria/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const contenu: string = String(body?.content ?? body?.contenu ?? '').trim();
    const matiere: string = String(body?.matiere ?? 'Mathematiques');
    const nom_eleve: string = String(body?.nom_eleve ?? 'Élève Debug');
    const type_document: string = String(body?.type_document ?? 'fiche_revision');

    const nom_fichier = `debug_${Date.now()}`;

    const res = await pdf_generator_service.generate_pdf({
      contenu: contenu || 'Contenu de test pour la génération PDF via le service distant.',
      type_document,
      matiere,
      nom_fichier,
      nom_eleve,
      footer_brand: 'ARIA',
      footer_show_date: true,
      footer_extra: 'Route de debug Next.js',
    });

    return NextResponse.json({ url: res.url, fileBase: nom_fichier });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}
