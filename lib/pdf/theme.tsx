// lib/pdf/theme.tsx
import { StyleSheet } from '@react-pdf/renderer';

export const theme = {
  primary: '#0f172a',
  accent: '#1f6feb',
  muted: '#64748b',
  line: '#e5e7eb',
  green: '#16a34a',
  amber: '#f59e0b',
  red: '#ef4444',
};

export const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: theme.primary, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  h3: { fontSize: 12, fontWeight: 700, marginTop: 10, marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.5 },
  small: { fontSize: 9, color: theme.muted },
  card: { borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 10 },
});

