import { prisma } from '../lib/prisma';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { BilanParentPDFDocument } from '../lib/pdf/bilan-parent-template';

async function main() {
  try {
    const bilan = await prisma.bilan.findFirst({
      where: { parentsMarkdown: { not: null } },
      select: {
        id: true,
        subject: true,
        studentName: true,
        globalScore: true,
        parentsMarkdown: true,
        publishedAt: true,
        createdAt: true,
        stage: { select: { title: true } },
        coach: { select: { pseudonym: true } },
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
      }
    });

    if (!bilan) {
      console.log('No Bilan found in the DB with parentsMarkdown.');
      return;
    }

    console.log('Found bilan in DB:', bilan.id);
    const childName = bilan.student?.user
      ? `${bilan.student.user.firstName ?? ''} ${bilan.student.user.lastName ?? ''}`.trim()
      : bilan.studentName;

    const SUBJECT_LABEL: Record<string, string> = {
      MATHEMATIQUES: 'Mathématiques',
      FRANCAIS: 'Français / EAF',
    };

    const pdfData = {
      studentName: childName || bilan.studentName || 'Élève',
      stageTitle: bilan.stage?.title ?? 'Stage',
      subjectLabel: SUBJECT_LABEL[bilan.subject] ?? bilan.subject,
      coachName: bilan.coach?.pseudonym ?? null,
      publishedAt: (bilan.publishedAt ?? bilan.createdAt).toISOString(),
      globalScore: bilan.globalScore,
      parentsMarkdown: bilan.parentsMarkdown,
    };

    console.log('Building PDF from DB bilan data...');
    const buffer = await renderToBuffer(React.createElement(BilanParentPDFDocument, { data: pdfData }));
    console.log('Success! Buffer length:', buffer.length);
  } catch (err) {
    console.error('Diagnostic error:', err);
  }
}

main();
