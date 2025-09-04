import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ensureInterRegistered, getNexusLogoSrc } from "./fonts";

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
  promo: { fontSize: 10, lineHeight: 1.5 },
  offerBox: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 6 },
  offerTitle: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  offerLine: { fontSize: 10, marginBottom: 2 },
});

export function BilanPdfParent({ data }: { data: any; }) {
  ensureInterRegistered();
  const logo = getNexusLogoSrc();
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString("fr-FR") : "";
  function badgeFor(percent: number): { label: string; bg: string; } {
    if (percent >= 75) return { label: 'Excellent', bg: '#16a34a' };
    if (percent >= 50) return { label: 'Solide', bg: '#16a34a' };
    return { label: 'À renforcer', bg: '#ef4444' };
  }
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.h1}>Rapport Parent — Bilan Stratégique</Text>
          {typeof logo === 'string' && logo.startsWith('data:image/') ? (
            <Image src={logo} style={{ width: 120, height: 36, objectFit: 'contain' }} />
          ) : null}
        </View>
        <Text style={styles.p}>Élève: {data.eleve?.firstName} {data.eleve?.lastName} • {data.eleve?.niveau || "—"} • {data.eleve?.statut || "—"}</Text>
        <Text style={styles.p}>Date: {date}</Text>

        <Text style={styles.h2}>1) Diagnostic académique</Text>
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

        <Text style={styles.h2}>2) Projection & ROI</Text>
        <View style={styles.card}>
          <Text style={styles.p}>Investir maintenant pour sécuriser la mention et Parcoursup. Un suivi Odyssée apporte structure, constance et visibilité pour la famille.</Text>
          <Text style={styles.promo}>ARIA (IA éducative 24/7) renforce l’autonomie avec des explications guidées, des exercices adaptés et un suivi des progrès en continu. Couplée à Odyssée, elle accélère les acquis et rassure la famille via des retours réguliers.</Text>
        </View>

        <Text style={styles.h2}>3) Offre recommandée</Text>
        <View style={styles.card}>
          <Text style={styles.p}>{data.recommandation?.primary || "—"}</Text>
          {data.recommandation?.reasoning && <Text style={styles.p}>{data.recommandation.reasoning}</Text>}
          {Array.isArray(data.recommandation?.alternatives) && data.recommandation.alternatives.length > 0 && (
            <Text style={styles.p}>Alternatives: {data.recommandation.alternatives.join(", ")}</Text>
          )}
          <Text style={styles.promo}>Proposition détaillée: démarrage par un diagnostic consolidé, séances hebdomadaires planifiées (1h encadrée + 2h d’exercices ARIA), bilan mensuel avec le coach, feuille de route réactualisée et accès complet à ARIA.</Text>
        </View>

        {/* Détails des offres Nexus */}
        <Text style={styles.h3}>Détails des offres Nexus</Text>
        <View style={styles.offerBox}>
          <Text style={styles.offerTitle}>Programme Odyssée</Text>
          <Text style={styles.offerLine}>• Suivi annuel premium, mention au Bac, coaching hebdomadaire</Text>
          <Text style={styles.offerLine}>• Bilan mensuel + feuille de route, parents rassurés</Text>
          <Text style={styles.offerLine}>• Accès complet ARIA 24/7, exercices adaptatifs</Text>
        </View>
        <View style={styles.offerBox}>
          <Text style={styles.offerTitle}>Studio Flex</Text>
          <Text style={styles.offerLine}>• Cours à la carte (individuel/groupe), en visio ou présentiel</Text>
          <Text style={styles.offerLine}>• Idéal pour un renfort ciblé avant DS/examen</Text>
          <Text style={styles.offerLine}>• Recommandations ARIA entre les séances</Text>
        </View>
        <View style={styles.offerBox}>
          <Text style={styles.offerTitle}>Académies Nexus</Text>
          <Text style={styles.offerLine}>• Stages intensifs vacances pour déclic rapide</Text>
          <Text style={styles.offerLine}>• Focus notions critiques, entraînements type Bac</Text>
        </View>

        <Text style={styles.h2}>4) Synthèse</Text>
        <View style={styles.card}>
          <Text style={styles.p}>{(data.summaryText || data.iaSummary || '').replace(/l[’']\s*élève/gi, (data.eleve?.firstName ? data.eleve.firstName : "l’élève")) || '—'}</Text>
        </View>

        <Text style={{ fontSize: 9, color: "#64748b", marginTop: 8 }}>Rapport confidentiel — usage parent</Text>
      </Page>
    </Document>
  );
}
