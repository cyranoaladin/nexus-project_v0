import { PrismaClient } from '@prisma/client';
import { pdf } from '@react-pdf/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import BilanPdf from '../lib/pdf/BilanPdf';
import BilanPdfParent from '../lib/pdf/BilanPdfParent';
import BilanPdfEleve from '../lib/pdf/BilanPdfEleve';
import { toPdfData } from '../lib/bilan/pdf-data-mapper';

async function main() {
  const prisma = new PrismaClient();
  const variant = (process.argv[2] || 'standard').toLowerCase();
  const bilanId = process.argv[3];
  try {
    const bilan = bilanId
      ? await prisma.bilan.findUnique({ where: { id: bilanId }, include: { student: { include: { user: true } } } })
      : await prisma.bilan.findFirst({ orderBy: { createdAt: 'desc' }, include: { student: { include: { user: true } } } });
    if (!bilan) throw new Error('No bilan found');

    const data = toPdfData(bilan);
    let doc: React.ReactElement;
    switch (variant) {
      case 'parent':
        doc = <BilanPdfParent data={data} />;
        break;
      case 'eleve':
        doc = <BilanPdfEleve data={data} />;
        break;
      default:
        doc = <BilanPdf data={data} />;
    }

    const buffer = await pdf(doc).toBuffer();
    const outDir = '/tmp';
    const outPath = path.join(outDir, `bilan-${bilan.id}-${variant}.pdf`);
    await fs.writeFile(outPath, buffer);
    console.log(JSON.stringify({ ok: true, bilanId: bilan.id, variant, outPath, size: buffer.length }, null, 2));
  } catch (e: any) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

