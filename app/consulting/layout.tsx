import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Consulting | Nexus Réussite - Expertise 360°',
  description: 'Conseil en ingénierie pédagogique, audit stratégique et solutions IA pour établissements scolaires et entreprises en Tunisie.',
};

export default function ConsultingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
