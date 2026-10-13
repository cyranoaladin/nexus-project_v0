import { LEGAL } from '@/lib/legal';
import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: `Centre pédagogique à ${LEGAL.addresses.pedagogique.neighborhood}, Tunis | Nexus Réussite`,
  description: `Centre pédagogique de Nexus Réussite : ${LEGAL.addresses.pedagogique.full}. Cours du bac français, stages et rendez-vous pédagogiques.`,
  alternates: { canonical: '/notre-centre' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: `Centre pédagogique à ${LEGAL.addresses.pedagogique.neighborhood}, Tunis | Nexus Réussite`,
    description: `Centre pédagogique : ${LEGAL.addresses.pedagogique.full}.`,
    type: "website",
  },
};

export default function NotreCentreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
