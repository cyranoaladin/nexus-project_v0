import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    if (process.env.NODE_ENV !== 'development' && process.env.E2E !== '1') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create or find a parent user
    const parentEmail = 'parent.dev+pdf@nexus.local';
    let parentUser = await prisma.user.findUnique({ where: { email: parentEmail } });
    if (!parentUser) {
      parentUser = await prisma.user.create({
        data: { email: parentEmail, firstName: 'Parent', lastName: 'Dev', role: 'PARENT', password: 'hashed' }
      });
      await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    }

    // Create or find a student linked to parent
    const studentEmail = 'eleve.dev+pdf@nexus.local';
    let studentUser = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: { email: studentEmail, firstName: 'Kam', lastName: 'BenR', role: 'ELEVE', password: 'hashed' }
      });
    }

    let student = await prisma.student.findFirst({ where: { userId: studentUser.id } });
    if (!student) {
      const parent = await prisma.parentProfile.findUnique({ where: { userId: parentUser.id } });
      student = await prisma.student.create({ data: { userId: studentUser.id, parentId: parent!.id, grade: 'Premiere' } });
    }

    // Create a bilan
    const bilan = await prisma.bilan.create({
      data: {
        studentId: student.id,
        subject: 'MATHEMATIQUES',
        niveau: 'Premiere',
        statut: 'scolarise_fr',
        qcmRaw: { seed: true },
        pedagoRaw: { style: 'auditif' },
        qcmScores: {
          total: 30, totalMax: 85,
          byDomain: {
            'Nombres & Calculs': { points: 10, max: 16, percent: 63 },
            'Équations / Inéquations': { points: 4, max: 17, percent: 24 },
            'Fonctions': { points: 2, max: 21, percent: 10 },
            'Géométrie & Trigonométrie': { points: 6, max: 15, percent: 40 },
            'Probabilités & Statistiques': { points: 6, max: 12, percent: 50 },
            'Algorithmique & Logique': { points: 2, max: 4, percent: 50 }
          }
        },
        pedagoProfile: { style: 'auditif', rhythm: 'irrégulier', motivation: 'réussir avec mention', confidence: 3 },
        synthesis: { forces: [], faiblesses: ['Équations / Inéquations', 'Fonctions', 'Géométrie & Trigonométrie'], feuilleDeRoute: ['S1–S2 : automatismes', 'S3–S4 : affines & carré', 'S5–S6 : trigonométrie', 'S7–S8 : probas/stats'] },
        offers: { primary: 'Odyssée', alternatives: ['Studio Flex'], reasoning: 'Besoin d’un cadre structurant' }
      }
    });

    return NextResponse.json({ ok: true, bilanId: bilan.id, studentId: student.id });
  } catch (e: any) {
    return NextResponse.json({ error: 'seed_failed', details: e?.message || String(e) }, { status: 500 });
  }
}
