import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Simple, premium-styled PDF doc. Extend later with logo/images if needed.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111827" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  p: { marginBottom: 4 },
  row: { flexDirection: "row", gap: 8 },
  tag: { fontSize: 10, backgroundColor: "#E5E7EB", padding: 3, borderRadius: 3, marginRight: 4 },
  section: { marginBottom: 10 },
});

export type BilanPdfProps = {
  bilan: {
    id: string;
    createdAt?: string;
    qcmScores: any;
    pedagoProfile: any;
    synthesis: any;
    offers: any;
  };
  student?: { firstName?: string; lastName?: string };
};

export function BilanPdf({ bilan, student }: BilanPdfProps) {
  const createdAt = bilan.createdAt ? new Date(bilan.createdAt).toLocaleDateString("fr-FR") : "";
  const qcm = bilan.qcmScores || {};
  const pedago = bilan.pedagoProfile || {};
  const synth = bilan.synthesis || {};
  const offers = bilan.offers || {};

  const domains = qcm?.byDomain ? Object.entries(qcm.byDomain) as [string, any][] : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h1}>Bilan Nexus Réussite</Text>
          <Text style={styles.p}>ID: {bilan.id}</Text>
          <Text style={styles.p}>Date: {createdAt}</Text>
          {student && (
            <Text style={styles.p}>Élève: {student.firstName || ""} {student.lastName || ""}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Scores QCM</Text>
          <Text style={styles.p}>Total: {qcm.total}/{qcm.totalMax}</Text>
          {domains.map(([name, d]) => (
            <Text key={name} style={styles.p}>• {name}: {d.points}/{d.max} ({d.percent}%)</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Profil pédagogique</Text>
          <Text style={styles.p}>Style: {pedago.style}</Text>
          <Text style={styles.p}>Rythme: {pedago.rhythm}</Text>
          <Text style={styles.p}>Motivation: {pedago.motivation}</Text>
          <Text style={styles.p}>Confiance: {pedago.confidence}/5</Text>
          <Text style={styles.p}>Méthodes: {(pedago.methods || []).join(', ')}</Text>
          <Text style={styles.p}>Environnement: {(pedago.environment || []).join(', ')}</Text>
          <Text style={styles.p}>Risques: {(synth.risques || []).join(', ')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Forces & Faiblesses</Text>
          <Text style={styles.p}>Forces: {(synth.forces || []).join(', ') || '—'}</Text>
          <Text style={styles.p}>Faiblesses: {(synth.faiblesses || []).join(', ') || '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Feuille de route</Text>
          {(synth.feuilleDeRoute || []).map((l: string, i: number) => (
            <Text key={i} style={styles.p}>• {l}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Offres recommandées</Text>
          <Text style={styles.p}>Offre principale: {offers.primary || '—'}</Text>
          <Text style={styles.p}>Alternatives: {(offers.alternatives || []).join(', ') || '—'}</Text>
          <Text style={styles.p}>Justification: {offers.reasoning || '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.p}>Mentions RGPD: ce bilan est confidentiel et peut être supprimé sur demande.</Text>
        </View>
      </Page>
    </Document>
  );
}

