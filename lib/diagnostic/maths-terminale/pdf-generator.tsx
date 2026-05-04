'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { SessionPlan, WeekPlan, DiagnosticResult } from './types';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 15,
  },
  brandName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#00D1FF', // Brand Accent
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  profileSection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  profileLabel: {
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  profileDesc: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00D1FF',
    paddingLeft: 8,
  },
  sessionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 25,
  },
  sessionCard: {
    width: '48%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginBottom: 8,
  },
  sessionNum: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 2,
  },
  sessionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  sessionObjective: {
    fontSize: 8,
    color: '#475569',
    fontStyle: 'italic',
  },
  weekCard: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  weekNum: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#10B981', // Emerald
  },
  weekDesc: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    fontSize: 8,
    color: '#94A3B8',
  }
});

interface RoadmapPDFProps {
  evaluatedData: DiagnosticResult;
  sessions: SessionPlan[];
  postStagePlan: WeekPlan[];
  studentName: string;
}

export const RoadmapPDFDocument: React.FC<RoadmapPDFProps> = ({
  evaluatedData,
  sessions,
  postStagePlan,
  studentName
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brandName}>Nexus Réussite</Text>
        <Text style={styles.title}>Parcours de Réussite Maths Terminale</Text>
        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 5 }}>
          Élève : {studentName} · Document de stratégie pédagogique
        </Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Profil Diagnostiqué</Text>
        <Text style={styles.profileValue}>{evaluatedData.calculatedProfile.label}</Text>
        <Text style={styles.profileDesc}>{evaluatedData.calculatedProfile.desc}</Text>
      </View>

      <Text style={styles.sectionTitle}>Stage Intensif : Plan de 16 heures</Text>
      <View style={styles.sessionGrid}>
        {sessions.map((s) => (
          <View key={s.num} style={styles.sessionCard}>
            <Text style={styles.sessionNum}>SÉANCE {s.num} · {s.type}</Text>
            <Text style={styles.sessionTitle}>{s.title}</Text>
            <Text style={styles.sessionObjective}>"{s.objectives[0]}"</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Stratégie Post-Stage : Vers l'Épreuve Finale</Text>
      {postStagePlan.map((w, i) => (
        <View key={i} style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>{w.title}</Text>
            <Text style={styles.weekNum}>{w.week.toUpperCase()}</Text>
          </View>
          <Text style={styles.weekDesc}>{w.desc}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text>Ce document est un outil de travail personnel. La régularité est la clé de la progression.</Text>
        <Text>© Nexus Réussite — 2026</Text>
      </View>
    </Page>
  </Document>
);
