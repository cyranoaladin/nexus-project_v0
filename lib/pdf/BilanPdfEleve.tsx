import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getNexusLogoSrc } from "./fonts";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111827" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 4 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  tr: { flexDirection: 'row' },
  th: { flex: 1, backgroundColor: '#F3F4F6', padding: 6, fontSize: 10, fontWeight: 700, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  td: { flex: 1, padding: 6, fontSize: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  tdLast: { borderRightWidth: 0 },
  badge: { fontSize: 9, paddingVertical: 2, paddingHorizontal: 6, color: '#fff', borderRadius: 9999, alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  logo: { width: 80, height: 24, objectFit: 'contain' },
});

export function BilanPdfEleve({ data }: { data: any; }) {
  const logo = getNexusLogoSrc();
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString("fr-FR") : "";
  function badgeFor(percent: number): { label: string; bg: string; } {
    if (percent >= 75) return { label: '🏆 Maître', bg: '#16a34a' };
    if (percent >= 50) return { label: 'Solide', bg: '#16a34a' };
    return { label: 'À renforcer', bg: '#ef4444' };
  }
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>Ton Bilan Nexus 🚀</Text>
          {/* Si logo invalide, on n'affiche rien pour éviter l'erreur runtime */}
          {typeof logo === 'string' && logo.startsWith('data:image/') ? (
            <Image src={logo} style={[styles.logo, { width: 120, height: 36 }]} />
          ) : null}
        </View>
        <Text style={styles.p}>Bravo {data.eleve?.firstName || 'l’ élève'} ! Voici tes résultats et ta feuille de route pour progresser.</Text>
        <Text style={styles.p}>Date: {date}</Text>

        <Text style={styles.h2}>1) Tes points forts</Text>
        <View style={styles.card}>
          {(data.forces || []).length ? (data.forces || []).map((x: string, i: number) => (<Text key={i} style={styles.p}>🏅 {x}</Text>)) : (<Text style={styles.p}>—</Text>)}
        </View>

        <Text style={styles.h2}>2) Axes de progression</Text>
        <View style={styles.card}>
          {(data.faiblesses || []).length ? (data.faiblesses || []).map((x: string, i: number) => (<Text key={i} style={styles.p}>🚀 {x}</Text>)) : (<Text style={styles.p}>—</Text>)}
        </View>

        <Text style={styles.h2}>3) Résultats par domaine</Text>
        {Array.isArray(data.scoresByDomain) && data.scoresByDomain.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={styles.th}>Domaine</Text>
              <Text style={styles.th}>Score</Text>
              <Text style={[styles.th, { borderRightWidth: 0 }]}>Badge</Text>
            </View>
            {data.scoresByDomain.map((d: any, i: number) => {
              const pct = Math.round(d?.percent || 0);
              const b = badgeFor(pct);
              return (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{d.domain}</Text>
                  <Text style={styles.td}>{pct}%</Text>
                  <View style={[styles.td, styles.tdLast]}>
                    <View style={[styles.badge, { backgroundColor: b.bg }]}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>{b.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.h2}>4) Feuille de route</Text>
        <View style={styles.card}>
          {(data.feuilleDeRoute || []).map((s: string, i: number) => (<Text key={i} style={styles.p}>➡️ {s}</Text>))}
        </View>

        <Text style={styles.h2}>5) Synthèse</Text>
        <View style={styles.card}>
          <Text style={styles.p}>{data.summaryText || data.iaSummary || '—'}</Text>
        </View>

        <Text style={{ fontSize: 9, color: "#64748b", marginTop: 8 }}>Rapport motivant — usage élève</Text>
      </Page>
    </Document>
  );
}
