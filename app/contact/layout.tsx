import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Contact | Nexus Réussite',
  description: 'Contactez Nexus Réussite via WhatsApp, téléphone ou formulaire. Le centre pédagogique est à Mutuelleville, le siège administratif au Centre Urbain Nord.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
