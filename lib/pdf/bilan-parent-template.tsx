/**
 * PDF template for parent-facing stage bilans.
 * Uses @react-pdf/renderer (already in dependencies).
 * Renders the parentsMarkdown content with light markdown parsing
 * (## / ### titles, lists, paragraphs, bold).
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface BilanParentPDFData {
  studentName: string;
  stageTitle: string;
  subjectLabel: string;
  coachName: string | null;
  publishedAt: string;
  globalScore: number | null;
  parentsMarkdown: string;
}

const COLORS = {
  brand: '#4f46e5',
  brandSoft: '#eef2ff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#0ea5e9',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: COLORS.text, lineHeight: 1.5 },
  brandBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: COLORS.brand },
  header: { marginBottom: 18, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` },
  brand: { fontSize: 9, color: COLORS.brand, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: 'bold', marginTop: 6, marginBottom: 4 },
  subtitle: { fontSize: 10, color: COLORS.muted },
  metaBox: { marginTop: 12, padding: 10, backgroundColor: COLORS.brandSoft, borderRadius: 6 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 90, color: COLORS.muted, fontSize: 9 },
  metaValue: { flex: 1, fontSize: 10, color: COLORS.text },
  scoreBig: { fontSize: 20, fontWeight: 'bold', color: COLORS.brand },
  h2: { fontSize: 14, fontWeight: 'bold', marginTop: 14, marginBottom: 6, color: COLORS.brand },
  h3: { fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 4, color: COLORS.text },
  h4: { fontSize: 11, fontWeight: 'bold', marginTop: 8, marginBottom: 3, color: COLORS.accent },
  paragraph: { marginBottom: 6, fontSize: 10.5, lineHeight: 1.55 },
  listItem: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  bullet: { width: 12, fontSize: 10.5 },
  listText: { flex: 1, fontSize: 10.5, lineHeight: 1.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: 'center',
    borderTop: `1px solid ${COLORS.border}`,
    paddingTop: 8,
  },
});

/**
 * Render a paragraph string, handling **bold** segments.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Text key={`${keyPrefix}-t-${i++}`}>{text.slice(lastIndex, match.index)}</Text>);
    }
    parts.push(
      <Text key={`${keyPrefix}-b-${i++}`} style={styles.bold}>
        {match[1]}
      </Text>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<Text key={`${keyPrefix}-t-${i++}`}>{text.slice(lastIndex)}</Text>);
  }
  if (parts.length === 0) {
    parts.push(<Text key={`${keyPrefix}-t-0`}>{text}</Text>);
  }
  return parts;
}

/**
 * Parse markdown into render blocks.
 * Supports: ##/###/#### headings, - lists, 1. lists, paragraphs, **bold**.
 * Strips LaTeX delimiters ($...$) since react-pdf cannot render them.
 */
function MarkdownBody({ markdown }: { markdown: string }) {
  // Strip code fences and inline LaTeX wrappers (keep math text readable)
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$(.+?)\$/g, '$1');

  const lines = cleaned.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paraBuffer: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (paraBuffer.length > 0) {
      const text = paraBuffer.join(' ').trim();
      if (text) {
        blocks.push(
          <Text key={`p-${key++}`} style={styles.paragraph}>
            {renderInline(text, `p${key}`)}
          </Text>
        );
      }
      paraBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer) {
      const isOrdered = listBuffer.type === 'ol';
      blocks.push(
        <View key={`list-${key++}`} style={{ marginBottom: 6 }}>
          {listBuffer.items.map((item, idx) => (
            <View key={`li-${key}-${idx}`} style={styles.listItem}>
              <Text style={styles.bullet}>{isOrdered ? `${idx + 1}.` : '•'}</Text>
              <Text style={styles.listText}>{renderInline(item, `li${key}-${idx}`)}</Text>
            </View>
          ))}
        </View>
      );
      listBuffer = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const h4 = line.match(/^####\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);

    if (h2 || h3 || h4) {
      flushPara();
      flushList();
      const heading = h2 ?? h3 ?? h4!;
      const styleObj = h2 ? styles.h2 : h3 ? styles.h3 : styles.h4;
      blocks.push(
        <Text key={`h-${key++}`} style={styleObj}>
          {heading[1]}
        </Text>
      );
    } else if (ul) {
      flushPara();
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ul[1]);
    } else if (ol) {
      flushPara();
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(ol[1]);
    } else {
      flushList();
      paraBuffer.push(line);
    }
  }
  flushPara();
  flushList();

  return <View>{blocks}</View>;
}

export function BilanParentPDFDocument({ data }: { data: BilanParentPDFData }) {
  const publishedDateLabel = new Date(data.publishedAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} fixed />

        <View style={styles.header}>
          <Text style={styles.brand}>Nexus Réussite</Text>
          <Text style={styles.title}>Bilan de stage — {data.subjectLabel}</Text>
          <Text style={styles.subtitle}>{data.stageTitle}</Text>

          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Élève :</Text>
              <Text style={styles.metaValue}>{data.studentName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Coach :</Text>
              <Text style={styles.metaValue}>{data.coachName ?? '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Publié le :</Text>
              <Text style={styles.metaValue}>{publishedDateLabel}</Text>
            </View>
            {data.globalScore !== null && (
              <View style={[styles.metaRow, { marginTop: 4 }]}>
                <Text style={styles.metaLabel}>Score global :</Text>
                <Text style={styles.scoreBig}>{Math.round(data.globalScore)}/100</Text>
              </View>
            )}
          </View>
        </View>

        <MarkdownBody markdown={data.parentsMarkdown} />

        <View style={styles.footer} fixed>
          <Text>
            Bilan généré par Nexus Réussite — Document confidentiel destiné à la famille de {data.studentName}
          </Text>
          <Text>© Nexus Réussite</Text>
        </View>
      </Page>
    </Document>
  );
};
