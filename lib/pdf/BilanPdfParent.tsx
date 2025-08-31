import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111827" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  p: { marginBottom: 4 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 6 },
});

export function BilanPdfParent({ data }: { data: any }) {
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString("fr-FR") : "";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Rapport Parent — Bilan Stratégique</Text>
        <Text style={styles.p}>Élève: {data.eleve?.firstName} {data.eleve?.lastName} • {data.eleve?.niveau || "—"} • {data.eleve?.statut || "—"}</Text>
        <Text style={styles.p}>Date: {date}</Text>

        <Text style={styles.h2}>1) Diagnostic académique</Text>
        <View style={styles.card}>
          {(data.scoresByDomain || []).map((d: any, i: number) => (
            <Text key={i} style={styles.p}>• {d.domain}: {d.percent}%</Text>
          ))}
        </View>

        <Text style={styles.h2}>2) Projection & ROI</Text>
        <View style={styles.card}>
          <Text style={styles.p}>Investir maintenant pour sécuriser la mention et Parcoursup. Un suivi Odyssée apporte structure, constance et visibilité pour la famille.</Text>
        </View>

        <Text style={styles.h2}>3) Offre recommandée</Text>
        <View style={styles.card}>
          <Text style={styles.p}>{data.recommandation?.primary || "—"}</Text>
          {data.recommandation?.reasoning && <Text style={styles.p}>{data.recommandation.reasoning}</Text>}
          {Array.isArray(data.recommandation?.alternatives) && data.recommandation.alternatives.length > 0 && (
            <Text style={styles.p}>Alternatives: {data.recommandation.alternatives.join(", ")}</Text>
          )}
        </View>

        <Text style={{ fontSize: 9, color: "#64748b", marginTop: 8 }}>Rapport confidentiel — usage parent</Text>
      </Page>
    </Document>
  );
}

