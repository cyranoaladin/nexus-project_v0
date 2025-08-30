// lib/pdf/BilanPdfEleve.tsx
import React from 'react';
import { Document, Page, Text } from '@react-pdf/renderer';
import { styles } from './theme';

export default function BilanPdfEleve({ data }: { data: any }) {
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
        <Text style={styles.h1}>Ton Bilan Nexus 🚀</Text>
        <Text style={styles.small}>Date: {date}</Text>

        <Text style={styles.h2}>1) Tes points forts</Text>
        {(data.forces || []).map((f: string, i: number) => (<Text key={i} style={styles.p}>🏅 {f}</Text>))}

        <Text style={styles.h2}>2) Axes de progression</Text>
        {(data.faiblesses || []).map((f: string, i: number) => (<Text key={i} style={styles.p}>🚀 {f}</Text>))}

        <Text style={styles.h2}>3) Feuille de route</Text>
        {(data.feuilleDeRoute || []).map((s: string, i: number) => (<Text key={i} style={styles.p}>➡️ {s}</Text>))}
      </Page>
    </Document>
  );
}

