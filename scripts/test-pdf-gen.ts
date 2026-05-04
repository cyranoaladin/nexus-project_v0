import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { BilanParentPDFDocument } from '../lib/pdf/bilan-parent-template';

async function main() {
  try {
    const pdfData = {
      studentName: 'Test Student',
      stageTitle: 'Test Stage',
      subjectLabel: 'Mathématiques',
      coachName: 'Test Coach',
      publishedAt: new Date().toISOString(),
      globalScore: 85,
      parentsMarkdown: '## Titre 2\n\nVoici un texte avec **du gras** et une liste:\n- Item 1\n- Item 2\n\n### Titre 3\nUn paragraphe normal.',
    };

    console.log('Rendering to buffer...');
    const buffer = await renderToBuffer(React.createElement(BilanParentPDFDocument, { data: pdfData }));
    console.log('Success! Buffer length:', buffer.length);
  } catch (err) {
    console.error('Caught error during PDF render:', err);
  }
}

main();
