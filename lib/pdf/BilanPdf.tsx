// lib/pdf/BilanPdf.tsx
import React from 'react';
import { Document, Page, Text, View, Svg, Rect } from '@react-pdf/renderer';
import { styles, theme } from './theme';
import { BilanPdfData } from '@/lib/bilan/types';

function ScoreBar({ label, percent }: { label: string; percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  let color = theme.red;
  if (percent >= 75) color = theme.green; else if (percent >= 50) color = theme.amber;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10 }}>{label}</Text>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>{Math.round(percent)}%</Text>
      </View>
      <Svg width="100%" height="6">
        <Rect x="0" y="0" width="100%" height="6" fill="#f1f5f9" />
        <Rect x="0" y="0" width={`${width}%`} height="6" fill={color} />
      </Svg>
    </View>
  );
}

export default function BilanPdf({ data }: { data: BilanPdfData }) {
  const date = (() => {
    if (!data.createdAt) return '';
    const d = new Date(data.createdAt);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  })();
  const scoreGlobal = (() => {
    const arr = data.scoresByDomain || [];
    const sum = arr.reduce((s, d) => s + (d.percent || 0), 0);
    return arr.length ? Math.round(sum / arr.length) : 0;
  })();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.h1}>Nexus Réussite — Rapport de Bilan</Text>
          <Text style={styles.small}>Généré par ARIA • Date : {date} • Score global estimé : {scoreGlobal}%</Text>
        </View>

        <View style={[styles.card, { marginBottom: 12 }]}>
          <Text style={styles.h3}>Élève</Text>
          <Text style={styles.p}>
            {data.eleve.firstName} {data.eleve.lastName} • {data.eleve.niveau || '—'} • {data.eleve.statut || '—'}
          </Text>
        </View>

        <Text style={styles.h2}>1) Diagnostic académique</Text>
        <View style={{ marginTop: 6 }}>
          {(data.scoresByDomain || []).map((d, i) => (
            <ScoreBar key={i} label={d.domain} percent={d.percent} />
          ))}
        </View>

        <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.h3}>Forces</Text>
            {(data.forces || []).length ? (data.forces || []).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>)) : (<Text style={styles.small}>—</Text>)}
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.h3}>Axes de progression</Text>
            {(data.faiblesses || []).length ? (data.faiblesses || []).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>)) : (<Text style={styles.small}>—</Text>)}
          </View>
        </View>

        <Text style={styles.h2}>2) Feuille de route (3–6 mois)</Text>
        <View style={[styles.card, { marginTop: 6 }]}>
          {(data.feuilleDeRoute || []).map((s, i) => (
            <Text key={i} style={styles.p}>{i + 1}. {s}</Text>
          ))}
        </View>

        <Text style={styles.h2}>3) Recommandations Nexus</Text>
        <View style={[styles.card, { marginTop: 6 }]}>
          <Text style={styles.h3}>Offre principale</Text>
          <Text style={styles.p}>{data.offrePrincipale || '—'}</Text>
          {data.offreReasoning && <Text style={[styles.small, { marginTop: 4 }]}>{data.offreReasoning}</Text>}
          {Array.isArray(data.alternatives) && data.alternatives.length > 0 && (
            <>
              <Text style={[styles.h3, { marginTop: 8 }]}>Alternatives</Text>
              {(data.alternatives).map((x, i) => (<Text key={i} style={styles.p}>• {x}</Text>))}
            </>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.small}>Données confidentielles — Rapport basé sur QCM, profil pédagogique et matrice d’aide à la décision Nexus.</Text>
        </View>
      </Page>
    </Document>
  );
}

