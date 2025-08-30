// lib/pdf/BilanPdfParent.tsx
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './theme';

export default function BilanPdfParent({ data }: { data: any }) {
  const date = (() => {
    if (!data.createdAt) return '';
    const d = new Date(data.createdAt);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  })();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Rapport Parent — Bilan Stratégique</Text>
        <Text style={styles.small}>Date: {date}</Text>

        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.h3}>Résumé</Text>
          <Text style={styles.p}>Ce rapport présente le niveau actuel, les axes prioritaires et les recommandations Nexus adaptées.</Text>
        </View>

        <Text style={styles.h2}>1) Diagnostic académique</Text>
        {(data.scoresByDomain || []).map((d: any, i: number) => (
          <Text key={i} style={styles.p}>• {d.domain}: {d.percent}%</Text>
        ))}

        <Text style={styles.h2}>2) Projection & ROI</Text>
        <Text style={styles.p}>Objectif: sécuriser la mention et Parcoursup. L’investissement est rationnalisé par les gains académiques et d’orientation.</Text>

        <Text style={styles.h2}>3) Offre recommandée</Text>
        <Text style={styles.p}>{data.offrePrincipale} — {data.offreReasoning}</Text>
      </Page>
    </Document>
  );
}

