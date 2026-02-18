/**
 * Assessment PDF Template — @react-pdf/renderer
 *
 * Premium institutional PDF document for assessment results.
 * Structure: Cover → SSN & Classification → Domain Analysis → Recommendations → Signature
 *
 * Identity: Noir profond, Bleu Nexus (#3b82f6), typographie académique.
 *
 * @module pdf/assessment-template
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainScoreData {
  domain: string;
  score: number;
}

interface SkillScoreData {
  skillTag: string;
  score: number;
}

export interface AssessmentPDFData {
  id: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  grade: string;
  globalScore: number;
  confidenceIndex: number;
  ssn: number | null;
  ssnLevel: string | null;
  percentile: number | null;
  domainScores: DomainScoreData[];
  skillScores: SkillScoreData[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  diagnosticText: string;
  createdAt: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const NEXUS_BLUE = '#3b82f6';
const DARK_BG = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_400 = '#94a3b8';
const WHITE = '#ffffff';

const styles = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
  },
  // Cover
  coverPage: {
    backgroundColor: DARK_BG,
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    color: NEXUS_BLUE,
    marginBottom: 40,
  },
  coverStudentName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    marginBottom: 8,
  },
  coverMeta: {
    fontSize: 12,
    color: SLATE_400,
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 11,
    color: SLATE_400,
    marginTop: 30,
  },
  // Section headers
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: DARK_BG,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: NEXUS_BLUE,
  },
  // SSN Card
  ssnContainer: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ssnValue: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: NEXUS_BLUE,
  },
  ssnLabel: {
    fontSize: 10,
    color: SLATE_400,
    marginBottom: 4,
  },
  ssnBadge: {
    backgroundColor: NEXUS_BLUE,
    color: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  // Score row
  scoreRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 14,
  },
  scoreCardLabel: {
    fontSize: 9,
    color: SLATE_400,
    marginBottom: 4,
  },
  scoreCardValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: DARK_BG,
  },
  // Domain table
  domainRow: {
    display: 'flex',
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  domainRowHeader: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 2,
    borderBottomColor: SLATE_700,
  },
  domainName: {
    flex: 3,
    fontSize: 10,
  },
  domainScore: {
    flex: 1,
    fontSize: 10,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  domainBar: {
    flex: 2,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  // Lists
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  listBullet: {
    width: 14,
    fontSize: 10,
    color: NEXUS_BLUE,
  },
  listText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: SLATE_400,
  },
  // Diagnostic text
  diagnosticText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 16,
  },
  // Signature
  signatureBlock: {
    marginTop: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    textAlign: 'center',
  },
  signatureName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: DARK_BG,
  },
  signatureRole: {
    fontSize: 9,
    color: SLATE_400,
    marginTop: 2,
  },
});

// ─── Helper Functions ───────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatDomain(domain: string): string {
  const labels: Record<string, string> = {
    analysis: 'Analyse',
    algebra: 'Algèbre',
    geometry: 'Géométrie',
    prob_stats: 'Probabilités & Statistiques',
    algorithmic: 'Algorithmique',
    complexes: 'Nombres complexes',
    suites: 'Suites',
    methodologie: 'Méthodologie',
    rigueur: 'Rigueur',
    comprehension: 'Compréhension',
    application: 'Application',
  };
  return labels[domain.toLowerCase()] || domain.replace(/_/g, ' ');
}

function formatSubject(subject: string): string {
  switch (subject) {
    case 'MATHS': return 'Mathématiques';
    case 'NSI': return 'NSI';
    case 'GENERAL': return 'Transversal';
    default: return subject;
  }
}

function formatGrade(grade: string): string {
  return grade === 'PREMIERE' ? 'Première' : 'Terminale';
}

// ─── PDF Document ───────────────────────────────────────────────────────────

export function AssessmentPDFDocument({ data }: { data: AssessmentPDFData }) {
  const formattedDate = new Date(data.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      {/* ─── Page 1: Cover ─────────────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverTitle}>Nexus Réussite</Text>
        <Text style={styles.coverSubtitle}>Bilan d&apos;Excellence Académique</Text>

        <Text style={styles.coverStudentName}>{data.studentName}</Text>
        <Text style={styles.coverMeta}>
          {formatSubject(data.subject)} — {formatGrade(data.grade)}
        </Text>
        <Text style={styles.coverMeta}>{data.studentEmail}</Text>

        <Text style={styles.coverDate}>{formattedDate}</Text>
        <Text style={{ ...styles.coverMeta, marginTop: 8, fontSize: 9 }}>
          Réf: {data.id}
        </Text>
      </Page>

      {/* ─── Page 2: SSN & Scores ──────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Score Standardisé Nexus (SSN)</Text>

        <View style={styles.ssnContainer}>
          <View>
            <Text style={styles.ssnLabel}>Score Standardisé Nexus</Text>
            <Text style={styles.ssnValue}>
              {data.ssn !== null ? Math.round(data.ssn) : '—'}/100
            </Text>
            {data.percentile !== null && (
              <Text style={{ fontSize: 9, color: SLATE_400, marginTop: 4 }}>
                {data.percentile}e percentile de la cohorte
              </Text>
            )}
          </View>
          {data.ssnLevel && (
            <Text style={styles.ssnBadge}>{data.ssnLevel}</Text>
          )}
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreCardLabel}>Score Brut</Text>
            <Text style={styles.scoreCardValue}>{data.globalScore}/100</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreCardLabel}>Indice de Confiance</Text>
            <Text style={styles.scoreCardValue}>{data.confidenceIndex}/100</Text>
          </View>
        </View>

        {/* Domain Analysis */}
        {data.domainScores.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Analyse par Domaine</Text>
            <View style={{ ...styles.domainRow, ...styles.domainRowHeader }}>
              <Text style={{ ...styles.domainName, fontFamily: 'Helvetica-Bold', fontSize: 9 }}>
                Domaine
              </Text>
              <Text style={{ ...styles.domainScore, fontSize: 9 }}>Score</Text>
              <Text style={{ ...styles.domainBar, fontSize: 9 }}>Niveau</Text>
            </View>
            {data.domainScores.map((d) => (
              <View key={d.domain} style={styles.domainRow}>
                <Text style={styles.domainName}>{formatDomain(d.domain)}</Text>
                <Text style={{ ...styles.domainScore, color: getScoreColor(d.score) }}>
                  {Math.round(d.score)}/100
                </Text>
                <View style={styles.domainBar}>
                  <View
                    style={{
                      width: `${Math.min(100, d.score)}%`,
                      height: 8,
                      backgroundColor: getScoreColor(d.score),
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Text>Nexus Réussite — Bilan Confidentiel</Text>
          <Text>Page 2</Text>
        </View>
      </Page>

      {/* ─── Page 3: Analysis & Recommendations ────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Diagnostic</Text>
        <Text style={styles.diagnosticText}>{data.diagnosticText}</Text>

        {data.strengths.length > 0 && (
          <>
            <Text style={{ ...styles.sectionTitle, borderBottomColor: '#10b981' }}>
              Points Forts
            </Text>
            {data.strengths.map((s, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={{ ...styles.listBullet, color: '#10b981' }}>+</Text>
                <Text style={styles.listText}>{s}</Text>
              </View>
            ))}
          </>
        )}

        {data.weaknesses.length > 0 && (
          <>
            <Text style={{ ...styles.sectionTitle, borderBottomColor: '#ef4444', marginTop: 16 }}>
              Axes d&apos;Amélioration
            </Text>
            {data.weaknesses.map((w, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={{ ...styles.listBullet, color: '#ef4444' }}>-</Text>
                <Text style={styles.listText}>{w}</Text>
              </View>
            ))}
          </>
        )}

        {data.recommendations.length > 0 && (
          <>
            <Text style={{ ...styles.sectionTitle, marginTop: 16 }}>
              Recommandations
            </Text>
            {data.recommendations.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listBullet}>{i + 1}.</Text>
                <Text style={styles.listText}>{r}</Text>
              </View>
            ))}
          </>
        )}

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <Text style={styles.signatureName}>Nexus Réussite Academy</Text>
          <Text style={styles.signatureRole}>
            Document généré automatiquement le {formattedDate}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Nexus Réussite — Bilan Confidentiel</Text>
          <Text>Page 3</Text>
        </View>
      </Page>
    </Document>
  );
}
