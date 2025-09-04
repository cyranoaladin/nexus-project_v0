import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getNexusLogoSrc } from "./fonts";

// Simple, premium-styled PDF doc. Extend later with logo/images if needed.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: "#111827" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 4 },
  row: { flexDirection: "row", gap: 8 },
  tag: { fontSize: 10, backgroundColor: "#E5E7EB", padding: 3, borderRadius: 3, marginRight: 4 },
  section: { marginBottom: 10 },
  table: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  tr: { flexDirection: 'row' },
  th: { flex: 1, backgroundColor: '#F3F4F6', padding: 6, fontSize: 10, fontWeight: 700, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  td: { flex: 1, padding: 6, fontSize: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  tdLast: { borderRightWidth: 0 },
  badge: { fontSize: 9, paddingVertical: 2, paddingHorizontal: 6, color: '#fff', borderRadius: 9999, alignSelf: 'flex-start' },
});

export type BilanPdfProps = {
  bilan: {
    id: string;
    createdAt?: string;
    qcmScores: any;
    pedagoProfile: any;
    synthesis: any;
    offers: any;
    subject?: string;
    niveau?: string;
  };
  student?: { firstName?: string; lastName?: string; };
};

export function BilanPdf({ bilan, student }: BilanPdfProps) {
  const logo = getNexusLogoSrc();
  const createdAt = bilan.createdAt ? new Date(bilan.createdAt).toLocaleDateString("fr-FR") : "";
  const qcm = bilan.qcmScores || {};
  const pedago = bilan.pedagoProfile || {};
  const synth = bilan.synthesis || {};
  const offers = bilan.offers || {};

  const domains = qcm?.byDomain ? Object.entries(qcm.byDomain) as [string, any][] : [];
  const globalPercent = (() => {
    try {
      if (typeof qcm.total === 'number' && typeof qcm.totalMax === 'number' && qcm.totalMax > 0) {
        return Math.round((100 * qcm.total) / qcm.totalMax);
      }
    } catch {}
    return null;
  })();

  function badgeFor(percent: number): { label: string; bg: string; } {
    if (percent >= 75) return { label: 'Excellent', bg: '#16a34a' };
    if (percent >= 50) return { label: 'Solide', bg: '#16a34a' };
    return { label: 'À renforcer', bg: '#ef4444' };
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.h1}>Bilan Nexus Réussite</Text>
            {typeof logo === 'string' && logo.startsWith('data:image/') ? (
              <Image src={logo} style={{ width: 120, height: 36, objectFit: 'contain' }} />
            ) : null}
          </View>
          <Text style={styles.p}>ID: {bilan.id}</Text>
          <Text style={styles.p}>Date: {createdAt}</Text>
          {student && (
            <Text style={styles.p}>Élève: {student.firstName || ""} {student.lastName || ""}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Scores QCM</Text>
          {(bilan.subject || bilan.niveau) && (
            <Text style={styles.p}>Matière: {bilan.subject || '—'} — Niveau: {bilan.niveau || '—'}</Text>
          )}
          <Text style={styles.p}>Total: {qcm.total}/{qcm.totalMax}{globalPercent !== null ? ` — ${globalPercent}%` : ''}</Text>
          {domains.length > 0 && (
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={styles.th}>Domaine</Text>
                <Text style={styles.th}>Points</Text>
                <Text style={styles.th}>Score</Text>
                <Text style={[styles.th, { borderRightWidth: 0 }]}>Badge</Text>
              </View>
              {domains.map(([name, d], i) => {
                const pct = Math.round(d?.percent || 0);
                const b = badgeFor(pct);
                return (
                  <View key={String(name)} style={styles.tr}>
                    <Text style={styles.td}>{name}</Text>
                    <Text style={styles.td}>{d?.points ?? 0}/{d?.max ?? 0}</Text>
                    <Text style={styles.td}>{pct}%</Text>
                    <View style={[styles.td, styles.tdLast]}>
                      <View style={[styles.badge, { backgroundColor: b.bg }]}>
                        <Text style={{ color: '#fff', fontSize: 9 }}>{b.label === 'Solide' ? 'Solide' : b.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
          <Text style={styles.h2}>Synthèse</Text>
          {synth.iaStudent && <Text style={styles.p}>{synth.iaStudent}</Text>}
          {synth.iaParent && (
            <Text style={styles.p}>{synth.iaParent}</Text>
          )}
          {!synth.iaStudent && !synth.iaParent && <Text style={styles.p}>—</Text>}
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
