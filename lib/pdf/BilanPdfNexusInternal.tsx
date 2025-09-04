import { Document, Page, StyleSheet, Text } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  h1: { fontSize: 18, marginBottom: 8 },
  h2: { fontSize: 14, marginTop: 12, marginBottom: 4 },
  code: { fontFamily: 'Courier', fontSize: 9, marginTop: 4 },
});

export default function BilanPdfNexusInternal({ data }: { data: any; }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Bilan — Nexus (Interne)</Text>
        <Text style={styles.h2}>Indices (preAnalyzedData)</Text>
        <Text style={styles.code}>{JSON.stringify(data?.preAnalyzedData || {}, null, 2)}</Text>
        <Text style={styles.h2}>QCM — Scores</Text>
        <Text style={styles.code}>{JSON.stringify(data?.qcmScores || {}, null, 2)}</Text>
        <Text style={styles.h2}>Volet 2 — Réponses brutes</Text>
        <Text style={styles.code}>{JSON.stringify(data?.pedagoRaw || {}, null, 2)}</Text>
        <Text style={styles.h2}>Profil Pédagogique</Text>
        <Text style={styles.code}>{JSON.stringify(data?.pedagoProfile || {}, null, 2)}</Text>
        <Text style={styles.h2}>Offres</Text>
        <Text style={styles.code}>{JSON.stringify(data?.offers || {}, null, 2)}</Text>
        <Text style={styles.h2}>Synthèse</Text>
        <Text style={styles.code}>{JSON.stringify(data?.synthesis || {}, null, 2)}</Text>
      </Page>
    </Document>
  );
}
