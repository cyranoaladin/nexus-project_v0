import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Nexus Academy | Excellence en Maths, NSI et Web3',
  description: 'Nexus Academy : cursus d\'excellence en Mathématiques, NSI et technologies Web3 pour lycéens ambitieux en Tunisie.',
};

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
