import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111827" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  p: { marginBottom: 4 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 6 },
});

export function BilanPdfEleve({ data }: { data: any }) {
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString("fr-FR") : "";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Ton Bilan Nexus 🚀</Text>
        <Text style={styles.p}>Bravo {data.eleve?.firstName} ! Voici tes résultats et ta feuille de route pour progresser.</Text>
        <Text style={styles.p}>Date: {date}</Text>

        <Text style={styles.h2}>1) Tes points forts</Text>
        <View style={styles.card}>
          {(data.forces || []).length ? (data.forces || []).map((x: string, i: number) => (<Text key={i} style={styles.p}>🏅 {x}</Text>)) : (<Text style={styles.p}>—</Text>)}
        </View>

        <Text style={styles.h2}>2) Axes de progression</Text>
        <View style={styles.card}>
          {(data.faiblesses || []).length ? (data.faiblesses || []).map((x: string, i: number) => (<Text key={i} style={styles.p}>🚀 {x}</Text>)) : (<Text style={styles.p}>—</Text>)}
        </View>

        <Text style={styles.h2}>3) Badges par domaine</Text>
        <View style={styles.card}>
          {(data.scoresByDomain || []).map((d: any, i: number) => {
            let badge = '🚀 À renforcer';
            if (d.percent >= 75) badge = '🏆 Maître';
            else if (d.percent >= 50) badge = '💪 Solide';
            return <Text key={i} style={styles.p}>{badge} — {d.domain} ({d.percent}%)</Text>;
          })}
        </View>

        <Text style={styles.h2}>4) Feuille de route</Text>
        <View style={styles.card}>
          {(data.feuilleDeRoute || []).map((s: string, i: number) => (<Text key={i} style={styles.p}>➡️ {s}</Text>))}
        </View>

        <Text style={{ fontSize: 9, color: "#64748b", marginTop: 8 }}>Rapport motivant — usage élève</Text>
      </Page>
    </Document>
  );
}

