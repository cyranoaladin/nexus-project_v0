import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.development' });
config({ path: '.env.local' });

import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';

function issueDevToken(payload, exp = '12h') {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET required to issue dev token');
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: exp });
}

async function main() {
  const hasPrisma = fs.existsSync(path.join(process.cwd(), 'prisma/schema.prisma'));
  if (!hasPrisma) throw new Error('Prisma schema not found. This seed expects Prisma.');

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // Attendre la disponibilité DB (10 tentatives ~10s)
  for (let i = 0; i < 10; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (e) {
      if (i === 9) throw new Error('DB not ready after 10s');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  try {
    // Admin (service)
    const admin = await prisma.user.upsert({
      where: { email: 'admin.dev@nexus.local' },
      update: {},
      create: { email: 'admin.dev@nexus.local', role: 'ADMIN', firstName: 'Admin', lastName: 'Dev' },
    });

    // Parent + profile
    const parent = await prisma.user.upsert({
      where: { email: 'parent.dev@nexus.local' },
      update: {},
      create: { email: 'parent.dev@nexus.local', role: 'PARENT', firstName: 'Parent', lastName: 'Dev' },
    });
    const parentProfile = await prisma.parentProfile.upsert({
      where: { userId: parent.id },
      update: {},
      create: { userId: parent.id },
    });

    // Élève + student
    const eleveUser = await prisma.user.upsert({
      where: { email: 'eleve.dev@nexus.local' },
      update: {},
      create: { email: 'eleve.dev@nexus.local', role: 'ELEVE', firstName: 'Eleve', lastName: 'Dev' },
    });
    const eleve = await prisma.student.upsert({
      where: { userId: eleveUser.id },
      update: {},
      create: { userId: eleveUser.id, parentId: parentProfile.id, grade: 'Première', credits: 1 },
    });

    // Bilan A (pdfBlob NULL)
    const bilanA = await prisma.bilan.create({
      data: {
        studentId: eleve.id,
        subject: 'NSI',
        niveau: 'Première',
        statut: 'scolarise_fr',
        qcmScores: { byDomain: { Algo: { percent: 70 } }, total: 14, totalMax: 20 },
        pedagoProfile: { vak: 'Visuel' },
        synthesis: { forces: ['Logique'], faiblesses: [], feuilleDeRoute: [] },
        offers: { primary: 'Cortex' },
        pdfBlob: null,
      },
    });

    // Bilan B (pdfBlob dummy)
    const bilanB = await prisma.bilan.create({
      data: {
        studentId: eleve.id,
        subject: 'NSI',
        niveau: 'Première',
        statut: 'scolarise_fr',
        qcmScores: { byDomain: { Algo: { percent: 85 } }, total: 17, totalMax: 20 },
        pedagoProfile: { vak: 'Auditif' },
        synthesis: { forces: ['Analyse'], faiblesses: [], feuilleDeRoute: [] },
        offers: { primary: 'Studio Flex' },
        pdfBlob: Buffer.from('%PDF-1.4\n% Dummy\n', 'utf8'),
      },
    });

    // Dev token (admin)
    const token = issueDevToken({ sub: admin.id, email: admin.email, role: 'ADMIN', dev: true });

    // Append to .env.local if not present
    const envLocal = path.join(process.cwd(), '.env.local');
    let wrote = false;
    try {
      let add = true;
      if (fs.existsSync(envLocal)) {
        const txt = fs.readFileSync(envLocal, 'utf8');
        if (txt.includes('DEV_TOKEN=')) add = false;
      }
      if (add) {
        fs.appendFileSync(envLocal, `\nDEV_TOKEN=${token}\n`);
        wrote = true;
      }
    } catch {}

    const out = {
      ok: true,
      wrote_env: wrote,
      admin: { id: admin.id, email: admin.email },
      parent: { id: parent.id, email: parent.email },
      student: { id: eleve.id, userId: eleveUser.id, email: eleveUser.email },
      bilans: { bilanA: bilanA.id, bilanB: bilanB.id },
      dev_token: token,
    };
    console.log(JSON.stringify(out, null, 2));

    // Écrire un fichier d’artefact pour les smokes
    try {
      fs.writeFileSync(path.join(process.cwd(), '.nexus-seed.json'), JSON.stringify(out, null, 2));
    } catch {}
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
