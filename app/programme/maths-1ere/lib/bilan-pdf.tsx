/**
 * F48: PDF Export for Maths 1ere Bilan
 * Lightweight PDF generation using @react-pdf/renderer
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer';

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
  },
  value: {
    color: '#333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
  strong: {
    fontWeight: 'bold',
  },
});

// Types for bilan data
export interface BilanPDFData {
  studentName: string;
  displayName: string;
  completedChapters: number;
  totalChapters: number;
  coverage: number;
  totalXP: number;
  streak: number;
  dueReviews: number;
  niveau: string;
  date: string;
  forces: { chapTitre: string; percent: number }[];
  priorites: { chapTitre: string; percent: number }[];
}

// PDF Document Component
const BilanPDFDocument: React.FC<{ data: BilanPDFData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Nexus Réussite — Bilan de Progression</Text>
        <Text style={styles.subtitle}>
          Stage Printemps 2026 · {data.niveau}
        </Text>
        <Text style={styles.subtitle}>Généré le {data.date}</Text>
      </View>

      {/* Student Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Élève</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nom:</Text>
          <Text style={styles.value}>{data.displayName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Chapitres complétés:</Text>
          <Text style={styles.value}>{data.completedChapters} / {data.totalChapters}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Couverture programme:</Text>
          <Text style={styles.value}>{data.coverage}%</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiques</Text>
        <View style={styles.row}>
          <Text style={styles.label}>XP Total:</Text>
          <Text style={styles.value}>{data.totalXP}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Série (jours):</Text>
          <Text style={styles.value}>{data.streak}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Révisions SRS en attente:</Text>
          <Text style={styles.value}>{data.dueReviews}</Text>
        </View>
      </View>

      {/* Forces */}
      {data.forces.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points Forts (≥ 75%)</Text>
          {data.forces.map((f, i) => (
            <View key={i} style={styles.row}>
              <Text>{f.chapTitre}</Text>
              <Text style={styles.strong}>{f.percent}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Priorities */}
      {data.priorites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priorités (&lt; 60%)</Text>
          {data.priorites.map((p, i) => (
            <View key={i} style={styles.row}>
              <Text>{p.chapTitre}</Text>
              <Text style={styles.strong}>{p.percent}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommandation</Text>
        <Text>
          Groupe de travail suggéré: {' '}
          {data.coverage >= 70 ? 'A (autonome)' : data.coverage >= 40 ? 'B (intermédiaire)' : 'C (soutien renforcé)'}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>
          Ce bilan est généré automatiquement par Nexus Réussite sur la base des résultats réels de l&apos;élève.
        </Text>
        <Text>© Nexus Réussite — 2026</Text>
      </View>
    </Page>
  </Document>
);

// PDF Download Button Component
interface BilanPDFButtonProps {
  data: BilanPDFData;
  fileName?: string;
  children: React.ReactNode;
}

export const BilanPDFDownloadButton: React.FC<BilanPDFButtonProps> = ({
  data,
  fileName = `bilan-nexus-${data.studentName || 'eleve'}-${new Date().toISOString().split('T')[0]}.pdf`,
  children,
}) => {
  return (
    <PDFDownloadLink document={<BilanPDFDocument data={data} />} fileName={fileName}>
      {({ loading }) => (
        <span className={loading ? 'opacity-50' : ''}>
          {loading ? 'Génération du PDF...' : children}
        </span>
      )}
    </PDFDownloadLink>
  );
};

export { BilanPDFDocument };
